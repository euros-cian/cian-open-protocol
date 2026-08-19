import {
  ComputeCoordinator, InMemoryComputeJobStore, LocalComputeProvider,
  RemoteComputeProviderClient, SettlementRegistry, createComputePoolServer,
  createSigningService, digest
} from "../src/index.js";

const now = () => new Date("2026-08-19T12:00:00Z");
const seriesId = "TB-CY-EXTERNAL-COMPUTE-DEMO";
const registry = new SettlementRegistry({ now, verifySignature: request => request.signature === "demo-valid" });
registry.registerAgent("agent:demo:welsh-service");
registry.allocate({ seriesId, allocations: [{ proof_id: "proof:demo:external-compute", recipient_agent_id: "agent:demo:welsh-service", amount: 4 }] });

const signer = createSigningService({ serviceId: "provider:cian:external-demo" });
const provider = new LocalComputeProvider({ signer, now });
const store = new InMemoryComputeJobStore({ now });
const coordinator = new ComputeCoordinator({ registry, store, now });
const providerToken = "demo-provider-token-at-least-32-characters";
const commitment = provider.createCommitment({ nominalCapacity: 10, availableFrom: "2026-08-19T11:00:00Z", availableUntil: "2026-08-19T13:00:00Z" });
await coordinator.registerProvider({ commitment, publicKeyPem: signer.publicKeyPem, apiToken: providerToken });

const workload = { kind: "sha256", text: "Mae cyfrifiadura allanol Cian yn gweithio." };
registry.lockRedemption({ redemption_id: "red:demo:external-compute", holder_agent: "agent:demo:welsh-service", series_id: seriesId, amount: 2, sender_sequence: 0, nonce: "nonce-demo-external-compute-0001", workload_digest: digest(workload), resource_classes: [provider.resourceClass], expires_at: "2026-08-19T13:00:00Z", signature: "demo-valid" });
const job = await coordinator.enqueue({ redemptionId: "red:demo:external-compute", workload });

const service = createComputePoolServer({ coordinator, store, adminToken: "demo-admin-token" });
const url = await service.listen();
try {
  console.log("Compute coordinator", url);
  console.log("Queued durable job", { job_id: job.job_id, status: job.status });
  console.log("To Bach ledger before", registry.ledgerSummary(seriesId));
  const client = new RemoteComputeProviderClient({ url, apiToken: providerToken, signer });
  const outcome = await client.runOnce(async input => ({ kind: "sha256", digest: digest(input.text) }));
  console.log("Provider result", outcome.job.result);
  console.log("Signed execution receipt", outcome.job.execution_receipt);
  console.log("Permanent retirement", outcome.retirement);
  console.log("To Bach ledger after", registry.ledgerSummary(seriesId));
} finally {
  await service.close();
}
