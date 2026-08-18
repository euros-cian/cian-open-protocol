import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  AgentClient, ConversationalProtocolAgent, EpochController, InMemoryProofStore,
  InteractionGateway, LanguageProofController, OpenAIResponsesProvider,
  SettlementRegistry, WelshValidator, createSigningService
} from "../src/index.js";

if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is required. Load it into this PowerShell session before running the live demo.");
  process.exitCode = 1;
} else {
  const gatewaySigner = createSigningService({ serviceId: "gateway:live-demo" });
  const validatorSigner = createSigningService({ serviceId: "validator:cy:live-demo" });
  const proofSigner = createSigningService({ serviceId: "proof-controller:live-demo" });
  const proofStore = new InMemoryProofStore();
  const identity = AgentClient.create({ registryUrl: "http://unused.local", endpoint: "local:openai-agent" });
  const registry = new SettlementRegistry();
  registry.registerAgent(identity.agentId);
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
  const terminal = createInterface({ input, output });
  console.log(`Live Cian agent: ${identity.agentId}`);
  console.log("Write in Welsh or mixed Welsh/English. Enter /close to close the demo epoch.\n");
  try {
    while (true) {
      const text = (await terminal.question("You: ")).trim();
      if (!text) continue;
      if (text === "/close") break;
      const result = await agent.handle({ sessionId: "terminal-session", text, humanOriginAssurance: "H1" });
      console.log(`\nAgent: ${result.response.text}\n`);
      console.log(result.proof
        ? `Protocol: ${result.validation.decision}, ${result.validation.reward_state}, proof ${result.proof.proof_id}`
        : `Protocol: ${result.validation.decision}; no Language Proof created.`);
    }
    const proofs = await proofStore.unconsumed("cy-v0.1");
    if (proofs.length) {
      const epoch = new EpochController({
        proofStore, registry, signer: createSigningService({ serviceId: "epoch-controller:live-demo" })
      });
      const report = await epoch.close({
        seriesId: `TB-CY-LIVE-${Date.now()}`, languageProfile: "cy-v0.1",
        commitments: [{ nominal_capacity: 100, assurance_ppm: 1_000_000, availability_ppm: 1_000_000, reserve_ppm: 800_000 }],
        computeUnitsPerEntitlement: 10
      });
      console.log("\nDemo epoch closed:", report);
      console.log("Agent balance:", registry.balance(identity.agentId, report.series_id));
    } else {
      console.log("\nNo qualifying Welsh proofs; no epoch allocation was made.");
    }
  } finally {
    terminal.close();
  }
}
