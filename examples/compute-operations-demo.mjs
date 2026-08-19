import { ComputeCoordinator, InMemoryComputeJobStore, LocalComputeProvider, SettlementRegistry, createSigningService, digest } from "../src/index.js";

const now = () => new Date("2026-08-19T12:00:00Z");
const registry = new SettlementRegistry({ now, verifySignature: request => request.signature === "demo-valid" });
registry.registerAgent("agent:demo:operations");
registry.allocate({ seriesId: "TB-CY-OPERATIONS-DEMO", allocations: [{ proof_id: "proof:operations-demo", recipient_agent_id: "agent:demo:operations", amount: 2 }] });
const signer = createSigningService({ serviceId: "provider:demo:operations" });
const provider = new LocalComputeProvider({ signer, now });
const store = new InMemoryComputeJobStore({ now });
const coordinator = new ComputeCoordinator({ registry, store, now, queueAlertThreshold: 0 });
const commitment = provider.createCommitment({ nominalCapacity: 2, availableFrom: "2026-08-19T11:00:00Z", availableUntil: "2026-08-19T13:00:00Z" });
await coordinator.registerProvider({ commitment, publicKeyPem: signer.publicKeyPem, apiToken: "demo-operations-provider-token-32-characters" });

const workload = { kind: "sha256", text: "Monitro diogel" };
registry.lockRedemption({ redemption_id: "red:operations-demo", holder_agent: "agent:demo:operations", series_id: "TB-CY-OPERATIONS-DEMO", amount: 1, sender_sequence: 0, nonce: "nonce-operations-demo-0001", workload_digest: digest(workload), resource_classes: [provider.resourceClass], expires_at: "2026-08-19T13:00:00Z", signature: "demo-valid" });
await coordinator.enqueue({ redemptionId: "red:operations-demo", workload });
console.log("Before incident", await coordinator.operations());
await coordinator.suspendProvider(signer.serviceId, "incident_review");
console.log("Suspended — claim result", await coordinator.claim(signer.serviceId));
console.log("Incident view", await coordinator.operations());
await coordinator.resumeProvider(signer.serviceId);
console.log("Resumed — claimed job", (await coordinator.claim(signer.serviceId)).job_id);
console.log("MILESTONE_22_PASS");
