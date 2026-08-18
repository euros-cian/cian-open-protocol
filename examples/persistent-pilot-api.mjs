import { mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  AgentClient, ConversationalProtocolAgent, InteractionGateway, LanguageProofController, PostgresAppealStore,
  OpenAIResponsesProvider, PostgresPilotSessionStore, PostgresProofStore, PostgresSettlementRegistry,
  RemoteWelshValidator, WelshValidator, createConversationServer, createSigningService
} from "../src/index.js";

const required = ["OPENAI_API_KEY", "CIAN_DATABASE_URL", "CIAN_PILOT_KEY_PASSPHRASE", "CIAN_SESSION_ISSUER_TOKEN"];
const missing = required.filter(name => !process.env[name]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exitCode = 1;
} else {
  const secretsDirectory = resolve(process.env.CIAN_PILOT_SECRETS_DIR ?? "secrets/pilot");
  mkdirSync(secretsDirectory, { recursive: true, mode: 0o700 });
  const credential = (name) => join(secretsDirectory, `${name}.credentials.json`);
  const signingService = (serviceId, name) => createSigningService({
    serviceId, credentialsPath: credential(name), passphrase: process.env.CIAN_PILOT_KEY_PASSPHRASE
  });
  const registry = await PostgresSettlementRegistry.connect({
    connectionString: process.env.CIAN_DATABASE_URL, registryId: "registry:cy:pilot"
  });
  const gatewaySigner = signingService("gateway:cy:pilot", "gateway");
  const independentValidator = Boolean(process.env.CIAN_VALIDATOR_URL);
  const validatorSigner = independentValidator ? null : signingService("validator:cy:pilot", "validator");
  const validatorPublicKey = independentValidator
    ? readFileSync(join(secretsDirectory, "validator-public.pem"), "utf8")
    : validatorSigner.publicKeyPem;
  const validatorKeyId = independentValidator ? "validator:cy:independent#key-1" : validatorSigner.keyId;
  const proofSigner = signingService("proof-controller:cy:pilot", "proof-controller");
  const identity = AgentClient.createPersistent({
    credentialsPath: credential("agent"), passphrase: process.env.CIAN_PILOT_KEY_PASSPHRASE,
    registryUrl: "http://local.postgres", endpoint: "pilot:openai-agent",
    capabilities: ["conversation"], languageProfiles: ["cy-v0.1"]
  });
  await registry.registerAgent(identity.manifest());
  const agent = new ConversationalProtocolAgent({
    agentId: identity.agentId,
    provider: new OpenAIResponsesProvider({
      apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL ?? "gpt-5.6-luna"
    }),
    gateway: new InteractionGateway({ signer: gatewaySigner }),
    validator: independentValidator
      ? new RemoteWelshValidator({ url: process.env.CIAN_VALIDATOR_URL, apiToken: process.env.CIAN_VALIDATOR_API_TOKEN })
      : new WelshValidator({ signer: validatorSigner }),
    proofController: new LanguageProofController({
      signer: proofSigner,
      trustedGateways: [[gatewaySigner.keyId, gatewaySigner.publicKeyPem]],
      trustedValidators: [[validatorKeyId, validatorPublicKey]]
    }),
    proofStore: new PostgresProofStore({ pool: registry.pool })
  });
  const service = createConversationServer({
    agent, sessionIssuerToken: process.env.CIAN_SESSION_ISSUER_TOKEN,
    sessions: new PostgresPilotSessionStore({ pool: registry.pool }),
    appeals: new PostgresAppealStore({ pool: registry.pool })
  });
  const address = await service.listen({
    host: process.env.CIAN_PILOT_HOST ?? "127.0.0.1",
    port: Number(process.env.CIAN_PILOT_PORT ?? 8790)
  });
  console.log(`Cian pilot API listening at ${address}`);
  console.log(`Persistent agent: ${identity.agentId}`);
  console.log(`Validator mode: ${independentValidator ? "independent remote service" : "in-process alpha fallback"}`);
  console.log("Press Ctrl+C to stop. Use TLS termination before exposing this service to a network.");

  const close = async () => {
    await service.close();
    await registry.close();
    process.exit(0);
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
}
