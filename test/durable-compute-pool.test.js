import test from "node:test";
import assert from "node:assert/strict";
import {
  ComputeCoordinator, InMemoryComputeJobStore, LocalComputeProvider,
  RemoteComputeProviderClient, SettlementRegistry, createComputePoolServer,
  createExecutionReceipt, createSigningService, digest
} from "../src/index.js";

const fixedNow = () => new Date("2026-08-19T12:00:00Z");
const providerToken = "provider-test-token-32-characters-minimum";

function fixture({ maxAttempts = 2, now = fixedNow } = {}) {
  const registry = new SettlementRegistry({ now, verifySignature: request => request.signature === "valid" });
  registry.registerAgent("agent:compute-holder");
  registry.allocate({ seriesId: "TB-CY-DURABLE", allocations: [{ proof_id: "proof:durable", recipient_agent_id: "agent:compute-holder", amount: 5 }] });
  const signer = createSigningService({ serviceId: "provider:external-test" });
  const provider = new LocalComputeProvider({ signer, now });
  const store = new InMemoryComputeJobStore({ now });
  const coordinator = new ComputeCoordinator({ registry, store, now, leaseMs: 1000, maxAttempts });
  const commitment = provider.createCommitment({ nominalCapacity: 5, availableFrom: "2026-08-19T11:00:00Z", availableUntil: "2026-08-19T13:00:00Z" });
  return { registry, signer, provider, store, coordinator, commitment };
}

async function registerAndQueue(state, suffix = "1") {
  await state.coordinator.registerProvider({ commitment: state.commitment, publicKeyPem: state.signer.publicKeyPem, apiToken: providerToken });
  const workload = { kind: "sha256", text: `Bore da ${suffix}` };
  state.registry.lockRedemption({ redemption_id: `red:durable:${suffix}`, holder_agent: "agent:compute-holder", series_id: "TB-CY-DURABLE", amount: 2, sender_sequence: 0, nonce: `nonce-durable-${suffix.padStart(4, "0")}`, workload_digest: digest(workload), resource_classes: ["local.safe-job.v1"], expires_at: "2026-08-19T13:00:00Z", signature: "valid" });
  const job = await state.coordinator.enqueue({ redemptionId: `red:durable:${suffix}`, workload });
  return { workload, job };
}

test("external provider completes a leased job and retires locked To Bach", async t => {
  const state = fixture();
  const queued = await registerAndQueue(state);
  const service = createComputePoolServer({ coordinator: state.coordinator, store: state.store, adminToken: "admin-token" });
  t.after(() => service.close());
  const url = await service.listen();
  const client = new RemoteComputeProviderClient({ url, apiToken: providerToken, signer: state.signer });
  const outcome = await client.runOnce(async workload => ({ kind: "sha256", digest: digest(workload.text) }));
  assert.equal(outcome.job.status, "completed");
  assert.equal(outcome.retirement.status, "permanently_retired");
  const publicResponse = await fetch(`${url}/v0.1/compute/jobs/${encodeURIComponent(queued.job.job_id)}`);
  const publicJob = await publicResponse.json();
  assert.equal(publicJob.workload, undefined);
  assert.equal(publicJob.status, "completed");
  const ledger = state.registry.ledgerSummary("TB-CY-DURABLE");
  assert.deepEqual({ circulating: ledger.circulating_total, locked: ledger.locked_total, retired: ledger.retired_total, valid: ledger.conservation_valid }, { circulating: 3, locked: 0, retired: 2, valid: true });
  const unauthorised = new RemoteComputeProviderClient({ url, apiToken: "wrong-token-that-is-still-long-enough", signer: state.signer });
  await assert.rejects(unauthorised.claim(), /authorisation/);
});

test("retry restores provider capacity and terminal failure refunds To Bach", async () => {
  const state = fixture({ maxAttempts: 2 });
  await registerAndQueue(state, "2");
  const first = await state.coordinator.claim(state.signer.serviceId);
  const retried = await state.coordinator.fail(state.signer.serviceId, first.job_id, { reasonCode: "temporary", retryable: true });
  assert.equal(retried.action, "requeued");
  assert.equal(state.registry.balance("agent:compute-holder", "TB-CY-DURABLE").locked, 2);
  const second = await state.coordinator.claim(state.signer.serviceId);
  const refunded = await state.coordinator.fail(state.signer.serviceId, second.job_id, { reasonCode: "still_failing", retryable: true });
  assert.equal(refunded.action, "refund");
  assert.equal(state.registry.redemption("red:durable:2").status, "refunded");
  assert.deepEqual(state.registry.balance("agent:compute-holder", "TB-CY-DURABLE"), { balance: 5, locked: 0, sequence: 1 });
  assert.equal(state.registry.ledgerSummary("TB-CY-DURABLE").retired_total, 0);
});

test("expired lease is refunded after the final permitted attempt", async () => {
  let current = new Date("2026-08-19T12:00:00Z");
  const now = () => new Date(current);
  const state = fixture({ maxAttempts: 1, now });
  await registerAndQueue(state, "3");
  await state.coordinator.claim(state.signer.serviceId);
  current = new Date("2026-08-19T12:00:02Z");
  const outcomes = await state.coordinator.reapExpired();
  assert.equal(outcomes[0].action, "refund");
  assert.equal(state.registry.redemption("red:durable:3").status, "refunded");
});

test("tampered execution receipt cannot retire To Bach", async () => {
  const state = fixture();
  await registerAndQueue(state, "4");
  const job = await state.coordinator.claim(state.signer.serviceId);
  const result = { kind: "sha256", digest: digest(job.workload.text) };
  const receipt = createExecutionReceipt({ signer: state.signer, job, result, resourceClass: "local.safe-job.v1", now: fixedNow });
  await assert.rejects(state.coordinator.complete(state.signer.serviceId, job.job_id, { result, receipt: { ...receipt, resource_class: "unrecognised" } }), /failed verification/);
  assert.equal(state.registry.redemption("red:durable:4").status, "locked");
});
