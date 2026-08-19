import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import { PostgresSettlementRegistry, createRegistryServer } from "../src/index.js";

const required = ["DATABASE_URL", "CIAN_ADMIN_TOKEN", "CIAN_REGISTRY_KEY_PASSPHRASE"];
const missing = required.filter(name => !process.env[name]);
if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
const credentialsPath = process.env.CIAN_REGISTRY_CREDENTIALS ?? "./secrets/registry.credentials.json";
mkdirSync(dirname(credentialsPath), { recursive: true, mode: 0o700 });
const registry = await PostgresSettlementRegistry.connect({ connectionString: process.env.DATABASE_URL, registryId: "registry:docker:local" });
const service = createRegistryServer({
  registry, registryId: "registry:docker:local", adminToken: process.env.CIAN_ADMIN_TOKEN,
  registryCredentialsPath: credentialsPath, registryPassphrase: process.env.CIAN_REGISTRY_KEY_PASSPHRASE
});
const address = await service.listen({ host: process.env.CIAN_REGISTRY_HOST ?? "127.0.0.1", port: Number(process.env.CIAN_REGISTRY_PORT ?? 8787) });
console.log(`Cian registry listening at ${address}`);
const close = async () => { await service.close(); await registry.close(); process.exit(0); };
process.once("SIGINT", close); process.once("SIGTERM", close);
