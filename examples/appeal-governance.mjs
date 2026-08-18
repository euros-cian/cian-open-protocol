import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  AppealReviewer, PostgresAppealStore, PostgresSettlementRegistry,
  createGovernanceServer, createSigningService
} from "../src/index.js";

const required = ["CIAN_DATABASE_URL", "CIAN_REVIEWER_KEY_PASSPHRASE", "CIAN_GOVERNANCE_API_TOKEN"];
const missing = required.filter(name => !process.env[name]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exitCode = 1;
} else {
  const directory = resolve(process.env.CIAN_REVIEWER_SECRETS_DIR ?? "secrets/reviewer");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const signer = createSigningService({
    serviceId: "reviewer:cy:pilot", credentialsPath: join(directory, "reviewer.credentials.json"),
    passphrase: process.env.CIAN_REVIEWER_KEY_PASSPHRASE
  });
  const registry = await PostgresSettlementRegistry.connect({ connectionString: process.env.CIAN_DATABASE_URL, registryId: "registry:cy:pilot" });
  const reviewer = new AppealReviewer({ store: new PostgresAppealStore({ pool: registry.pool }), signer });
  const service = createGovernanceServer({ reviewer, apiToken: process.env.CIAN_GOVERNANCE_API_TOKEN });
  const address = await service.listen({ host: "127.0.0.1", port: Number(process.env.CIAN_GOVERNANCE_PORT ?? 8792) });
  console.log(`Appeal governance service listening at ${address}`);
  console.log(`Reviewer key: ${signer.keyId}`);
  console.log("Resolutions are signed and prospective-only. Press Ctrl+C to stop.");
  const close = async () => { await service.close(); await registry.close(); process.exit(0); };
  process.once("SIGINT", close); process.once("SIGTERM", close);
}
