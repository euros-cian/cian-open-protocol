import {
  ComputeCoordinator, InMemoryComputeJobStore, LocalComputeProvider,
  RemoteComputeProviderClient, SettlementRegistry, createComputePoolServer,
  createSigningService, digest
} from "../src/index.js";

const now = () => new Date("2026-08-19T12:00:00Z");
const registry = new SettlementRegistry({ now, verifySignature: request => request.signature === "demo-valid" });
registry.registerAgent("agent:demo:multi-provider");
registry.allocate({ seriesId: "TB-CY-MULTI-DEMO", allocations: [{ proof_id: "proof:multi-demo", recipient_agent_id: "agent:demo:multi-provider", amount: 4 }] });
const store = new InMemoryComputeJobStore({ now });
const coordinator = new ComputeCoordinator({ registry, store, now });

async function addProvider(id, resourceClass, token) {
  const signer = createSigningService({ serviceId: id });
  const provider = new LocalComputeProvider({ signer, resourceClass, now });
  const commitment = provider.createCommitment({ nominalCapacity: 2, availableFrom: "2026-08-19T11:00:00Z", availableUntil: "2026-08-19T13:00:00Z" });
  await coordinator.registerProvider({ commitment, publicKeyPem: signer.publicKeyPem, apiToken: token });
  return { signer, provider, token };
}

const fast = await addProvider("provider:demo:fast", "compute.fast.v1", "demo-fast-token-at-least-32-characters");
const green = await addProvider("provider:demo:green", "compute.green.v1", "demo-green-token-at-least-32-characters");
for (const [index, resourceClass] of ["compute.fast.v1", "compute.green.v1"].entries()) {
  const workload = { kind: "sha256", text: `Tasg Gymraeg ${index + 1}` };
  registry.lockRedemption({ redemption_id: `red:multi-demo:${index + 1}`, holder_agent: "agent:demo:multi-provider", series_id: "TB-CY-MULTI-DEMO", amount: 1, sender_sequence: index, nonce: `nonce-multi-demo-000${index + 1}`, workload_digest: digest(workload), resource_classes: [resourceClass], expires_at: "2026-08-19T13:00:00Z", signature: "demo-valid" });
  await coordinator.enqueue({ redemptionId: `red:multi-demo:${index + 1}`, workload });
}

const service = createComputePoolServer({ coordinator, store, adminToken: "demo-admin-token" });
const url = await service.listen();
try {
  const clients = [fast, green].map(item => new RemoteComputeProviderClient({ url, apiToken: item.token, signer: item.signer, resourceClass: item.provider.resourceClass }));
  const outcomes = await Promise.all(clients.map(client => client.runOnce(async workload => ({ kind: "sha256", digest: digest(workload.text) }))));
  console.log("Independent providers", outcomes.map(outcome => ({ provider_id: outcome.job.provider_id, job_id: outcome.job.job_id, status: outcome.job.status, resource_class: outcome.job.execution_receipt.resource_class })));
  console.log("To Bach ledger", registry.ledgerSummary("TB-CY-MULTI-DEMO"));
  console.log("MILESTONE_20_PASS");
} finally {
  await service.close();
}
