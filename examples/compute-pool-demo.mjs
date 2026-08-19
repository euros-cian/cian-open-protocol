import { ComputePool, LocalComputeProvider, SettlementRegistry, createSigningService, digest } from "../src/index.js";

const now = () => new Date("2026-08-19T12:00:00Z");
const seriesId = "TB-CY-COMPUTE-DEMO";
const registry = new SettlementRegistry({ now, verifySignature: request => request.signature === "demo-valid" });
registry.registerAgent("agent:demo:welsh-service");
registry.allocate({ seriesId, allocations: [{ proof_id: "proof:demo:compute", recipient_agent_id: "agent:demo:welsh-service", amount: 4 }] });

const providerSigner = createSigningService({ serviceId: "provider:cian:local-safe" });
const provider = new LocalComputeProvider({ signer: providerSigner, now });
const commitment = provider.createCommitment({ nominalCapacity: 10, availableFrom: "2026-08-19T11:00:00Z", availableUntil: "2026-08-19T13:00:00Z", assurancePpm: 900_000, availabilityPpm: 900_000, reservePpm: 800_000 });
const pool = new ComputePool({ registry, now });
console.log("Provider commitment", pool.registerProvider({ commitment, publicKeyPem: providerSigner.publicKeyPem, provider }));

const workload = { kind: "sha256", text: "Mae'r pwll cyfrifiadurol yn gweithio." };
registry.lockRedemption({ redemption_id: "red:demo:compute", holder_agent: "agent:demo:welsh-service", series_id: seriesId, amount: 2, sender_sequence: 0, nonce: "nonce-demo-compute-0001", workload_digest: digest(workload), resource_classes: [provider.resourceClass], expires_at: "2026-08-19T13:00:00Z", signature: "demo-valid" });
console.log("To Bach ledger before compute", registry.ledgerSummary(seriesId));
const execution = await pool.execute({ redemptionId: "red:demo:compute", workload });
console.log("Safe compute result", execution.result);
console.log("Signed execution receipt", execution.receipt);
console.log("Permanent retirement", execution.retirement);
console.log("To Bach ledger after compute", registry.ledgerSummary(seriesId));
