import { randomBytes, randomUUID } from "node:crypto";
import {
  ComputeCoordinator, LocalComputeProvider, PostgresComputeJobStore,
  PostgresSettlementRegistry, agentIdFromPublicKey, createExecutionReceipt,
  createSigningService, digest, generateAgentKeys, exportPublicKey, signRecord
} from "../src/index.js";

if (!process.env.CIAN_DATABASE_URL) {
  console.error("CIAN_DATABASE_URL is required. It is read only from this PowerShell window and is never printed.");
  process.exit(1);
}

const runId = randomUUID();
const seriesId = `TB-CY-RESTART-${runId}`;
const redemptionId = `red:restart:${runId}`;
const workload = { kind: "sha256", text: "Mae swydd Cian wedi goroesi ailgychwyn." };
const agentKeys = generateAgentKeys();
const agentPublicKey = exportPublicKey(agentKeys.publicKey);
const agentId = agentIdFromPublicKey(agentKeys.publicKey);
const providerSigner = createSigningService({ serviceId: `provider:restart:${runId}` });
const provider = new LocalComputeProvider({ signer: providerSigner });
const providerToken = randomBytes(32).toString("base64url");
let registry;

try {
  registry = await PostgresSettlementRegistry.connect({ connectionString: process.env.CIAN_DATABASE_URL, registryId: "registry:cy:pilot" });
  await registry.registerAgent(signRecord({
    protocol_version: "0.1", agent_id: agentId, public_key: agentPublicKey,
    endpoint: "https://restart-demo.invalid", capabilities: ["compute-test"],
    language_profiles: ["cy-v0.2"], assurance_level: "A0",
    issued_at: new Date().toISOString()
  }, agentKeys.privateKey, `${agentId}#key-1`));
  await registry.allocate({ seriesId, allocations: [{ proof_id: `proof:restart:${runId}`, recipient_agent_id: agentId, amount: 2 }] });
  await registry.lockRedemption(signRecord({
    protocol_version: "0.1", redemption_id: redemptionId, holder_agent: agentId,
    series_id: seriesId, amount: 1, sender_sequence: 0,
    nonce: `nonce-restart-${runId}`, workload_digest: digest(workload),
    resource_classes: [provider.resourceClass],
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString()
  }, agentKeys.privateKey, `${agentId}#key-1`));
  const firstStore = new PostgresComputeJobStore({ pool: registry.pool });
  const firstCoordinator = new ComputeCoordinator({ registry, store: firstStore });
  const commitment = provider.createCommitment({ nominalCapacity: 2, availableFrom: new Date(Date.now() - 60_000).toISOString(), availableUntil: new Date(Date.now() + 10 * 60_000).toISOString() });
  await firstCoordinator.registerProvider({ commitment, publicKeyPem: providerSigner.publicKeyPem, apiToken: providerToken });
  const queued = await firstCoordinator.enqueue({ redemptionId, workload });
  console.log("Before restart", { series_id: seriesId, job_id: queued.job_id, job_status: queued.status, ledger: await registry.ledgerSummary(seriesId) });

  await registry.close();
  registry = null;
  console.log("Coordinator and PostgreSQL pool fully stopped.");

  registry = await PostgresSettlementRegistry.connect({ connectionString: process.env.CIAN_DATABASE_URL, registryId: "registry:cy:pilot" });
  const restartedStore = new PostgresComputeJobStore({ pool: registry.pool });
  const restartedCoordinator = new ComputeCoordinator({ registry, store: restartedStore });
  const restored = await restartedStore.job(queued.job_id);
  if (restored?.status !== "queued") throw new Error("queued job did not survive restart");
  console.log("After restart", { job_id: restored.job_id, job_status: restored.status, attempts: restored.attempts });

  const claimed = await restartedCoordinator.claim(providerSigner.serviceId);
  const result = { kind: "sha256", digest: digest(claimed.workload.text) };
  const receipt = createExecutionReceipt({ signer: providerSigner, job: claimed, result, resourceClass: provider.resourceClass });
  const completed = await restartedCoordinator.complete(providerSigner.serviceId, claimed.job_id, { result, receipt });
  const ledger = await registry.ledgerSummary(seriesId);
  if (completed.job.status !== "completed" || ledger.retired_total !== 1 || !ledger.conservation_valid) throw new Error("durable settlement verification failed");
  console.log("Durable settlement complete", { job_status: completed.job.status, retirement_status: completed.retirement.status, ledger });
  console.log("MILESTONE_19_PASS");
} finally {
  if (registry) await registry.close();
}
