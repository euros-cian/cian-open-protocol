import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  AgentClient, ConversationalProtocolAgent, EpochController, InteractionGateway,
  LanguageProofController, OpenAIResponsesProvider, PostgresProofStore,
  PostgresSettlementRegistry, WelshValidator, createSigningService
} from "../src/index.js";

const databaseUrl = process.env.CIAN_DATABASE_URL;
const passphrase = process.env.CIAN_PILOT_KEY_PASSPHRASE;
if (!process.env.OPENAI_API_KEY || !databaseUrl || !passphrase) {
  console.error("OPENAI_API_KEY, CIAN_DATABASE_URL and CIAN_PILOT_KEY_PASSPHRASE are required.");
  process.exitCode = 1;
} else {
  const secretsDirectory = resolve(process.env.CIAN_PILOT_SECRETS_DIR ?? "secrets/pilot");
  mkdirSync(secretsDirectory, { recursive: true, mode: 0o700 });
  const credential = (name) => join(secretsDirectory, `${name}.credentials.json`);
  const signingService = (serviceId, name) => createSigningService({
    serviceId, credentialsPath: credential(name), passphrase
  });
  const registry = await PostgresSettlementRegistry.connect({
    connectionString: databaseUrl, registryId: "registry:cy:pilot"
  });
  const terminal = createInterface({ input, output });
  try {
    const gatewaySigner = signingService("gateway:cy:pilot", "gateway");
    const validatorSigner = signingService("validator:cy:pilot", "validator");
    const proofSigner = signingService("proof-controller:cy:pilot", "proof-controller");
    const epochSigner = signingService("epoch-controller:cy:pilot", "epoch-controller");
    const identity = AgentClient.createPersistent({
      credentialsPath: credential("agent"), passphrase,
      registryUrl: "http://local.postgres", endpoint: "pilot:openai-agent",
      capabilities: ["conversation"], languageProfiles: ["cy-v0.1"]
    });
    await registry.registerAgent(identity.manifest());
    const proofStore = new PostgresProofStore({ pool: registry.pool });
    const agent = new ConversationalProtocolAgent({
      agentId: identity.agentId,
      provider: new OpenAIResponsesProvider({
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL ?? "gpt-5.6-luna"
      }),
      gateway: new InteractionGateway({ signer: gatewaySigner }),
      validator: new WelshValidator({ signer: validatorSigner }),
      proofController: new LanguageProofController({
        signer: proofSigner,
        trustedGateways: [[gatewaySigner.keyId, gatewaySigner.publicKeyPem]],
        trustedValidators: [[validatorSigner.keyId, validatorSigner.publicKeyPem]]
      }),
      proofStore
    });

    console.log(`Persistent Cian pilot agent: ${identity.agentId}`);
    console.log(`Credentials: ${secretsDirectory}`);
    console.log("Write in Welsh or mixed Welsh/English. Enter /close to close the epoch.\n");
    while (true) {
      const text = (await terminal.question("You: ")).trim();
      if (!text) continue;
      if (text === "/close") break;
      const result = await agent.handle({ sessionId: "pilot-terminal", text, humanOriginAssurance: "H1" });
      console.log(`\nAgent: ${result.response.text}\n`);
      console.log(result.proof
        ? `Protocol: ${result.validation.decision}, ${result.validation.reward_state}, proof ${result.proof.proof_id}`
        : `Protocol: ${result.validation.decision}; no Language Proof created.`);
    }

    const proofs = await proofStore.unconsumed("cy-v0.1");
    if (proofs.length) {
      const epoch = new EpochController({ proofStore, registry, signer: epochSigner });
      const report = await epoch.close({
        seriesId: `TB-CY-PILOT-${Date.now()}`, languageProfile: "cy-v0.1",
        commitments: [{ nominal_capacity: 100, assurance_ppm: 1_000_000, availability_ppm: 1_000_000, reserve_ppm: 800_000 }],
        computeUnitsPerEntitlement: 10
      });
      console.log("\nPilot epoch closed:", report);
      console.log("Persistent agent balance:", await registry.balance(identity.agentId, report.series_id));
    } else {
      console.log("\nNo qualifying Welsh proofs; no epoch allocation was made.");
    }
  } finally {
    terminal.close();
    await registry.close();
  }
}
