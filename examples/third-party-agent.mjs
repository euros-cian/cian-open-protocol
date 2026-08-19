import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { AgentClient } from "../src/index.js";

const registryUrl = process.env.CIAN_REGISTRY_URL ?? "http://127.0.0.1:8787";
const passphrase = process.env.CIAN_AGENT_KEY_PASSPHRASE;
if (!passphrase) {
  console.error("CIAN_AGENT_KEY_PASSPHRASE is required and must contain at least 12 characters.");
  process.exitCode = 1;
} else {
  const credentialsPath = resolve(process.env.CIAN_AGENT_CREDENTIALS ?? "secrets/third-party-agent.credentials.json");
  mkdirSync(dirname(credentialsPath), { recursive: true, mode: 0o700 });
  const agent = AgentClient.createPersistent({
    credentialsPath, passphrase, registryUrl,
    registryPublicKeyPem: process.env.CIAN_REGISTRY_PUBLIC_KEY,
    endpoint: process.env.CIAN_AGENT_ENDPOINT ?? "http://127.0.0.1:8890",
    capabilities: ["conversation", "task-execution"], languageProfiles: ["cy-v0.2"]
  });
  const registration = await agent.register();
  console.log("Registered third-party participant", registration);
  console.log("Agent ID", agent.agentId);
  if (process.env.CIAN_SERIES_ID) console.log("Balance", await agent.getBalance(process.env.CIAN_SERIES_ID));
  console.log("Encrypted identity", credentialsPath);
}
