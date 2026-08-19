import test from "node:test";
import assert from "node:assert/strict";
import { ComputeCoordinator, InMemoryComputeJobStore, LocalComputeProvider, SettlementRegistry, createExecutionReceipt, createSigningService, digest } from "../src/index.js";

const now = () => new Date("2026-08-19T12:00:00Z");

function setup() {
  const registry = new SettlementRegistry({ now, verifySignature: request => request.signature === "valid" });
  registry.registerAgent("agent:multi-holder");
  registry.allocate({ seriesId: "TB-CY-MULTI", allocations: [{ proof_id: "proof:multi", recipient_agent_id: "agent:multi-holder", amount: 6 }] });
  const store = new InMemoryComputeJobStore({ now });
  const coordinator = new ComputeCoordinator({ registry, store, now });
  return { registry, store, coordinator };
}

function makeProvider(serviceId, resourceClass, capacity = 2) {
  const signer = createSigningService({ serviceId });
  const provider = new LocalComputeProvider({ signer, resourceClass, now });
  const commitment = provider.createCommitment({ nominalCapacity: capacity, availableFrom: "2026-08-19T11:00:00Z", availableUntil: "2026-08-19T13:00:00Z" });
  return { signer, provider, commitment };
}

async function queue(state, suffix, sequence, resourceClasses) {
  const workload = { kind: "sha256", text: `Tasg ${suffix}` };
  state.registry.lockRedemption({ redemption_id: `red:multi:${suffix}`, holder_agent: "agent:multi-holder", series_id: "TB-CY-MULTI", amount: 1, sender_sequence: sequence, nonce: `nonce-multi-${suffix.padStart(8, "0")}`, workload_digest: digest(workload), resource_classes: resourceClasses, expires_at: "2026-08-19T13:00:00Z", signature: "valid" });
  return state.coordinator.enqueue({ redemptionId: `red:multi:${suffix}`, workload });
}

test("concurrent providers claim distinct compatible jobs and respect capacity", async () => {
  const state = setup();
  const fast = makeProvider("provider:multi:fast", "compute.fast.v1", 1);
  const green = makeProvider("provider:multi:green", "compute.green.v1", 2);
  await state.coordinator.registerProvider({ commitment: fast.commitment, publicKeyPem: fast.signer.publicKeyPem, apiToken: "fast-provider-token-at-least-32-characters" });
  await state.coordinator.registerProvider({ commitment: green.commitment, publicKeyPem: green.signer.publicKeyPem, apiToken: "green-provider-token-at-least-32-characters" });
  const shared = await queue(state, "1", 0, ["compute.fast.v1", "compute.green.v1"]);
  const greenOnly = await queue(state, "2", 1, ["compute.green.v1"]);
  const fastOnly = await queue(state, "3", 2, ["compute.fast.v1"]);
  const [fastJob, greenJob] = await Promise.all([state.coordinator.claim(fast.signer.serviceId), state.coordinator.claim(green.signer.serviceId)]);
  assert.equal(new Set([fastJob.job_id, greenJob.job_id]).size, 2);
  assert.equal(fastJob.job_id, shared.job_id);
  assert.equal(greenJob.job_id, greenOnly.job_id);
  assert.equal(await state.coordinator.claim(fast.signer.serviceId), null, "fast capacity is exhausted");
  assert.equal((await state.store.job(fastOnly.job_id)).status, "queued");
});

test("two compatible providers can never claim one job twice", async () => {
  const state = setup();
  const first = makeProvider("provider:race:first", "compute.shared.v1");
  const second = makeProvider("provider:race:second", "compute.shared.v1");
  await state.coordinator.registerProvider({ commitment: first.commitment, publicKeyPem: first.signer.publicKeyPem, apiToken: "first-provider-token-at-least-32-characters" });
  await state.coordinator.registerProvider({ commitment: second.commitment, publicKeyPem: second.signer.publicKeyPem, apiToken: "second-provider-token-at-least-32-characters" });
  const queued = await queue(state, "race", 0, ["compute.shared.v1"]);
  const claims = await Promise.all([state.coordinator.claim(first.signer.serviceId), state.coordinator.claim(second.signer.serviceId)]);
  assert.equal(claims.filter(Boolean).length, 1);
  assert.equal(claims.find(Boolean).job_id, queued.job_id);
});

test("receipt must match the exact commitment resource class", async () => {
  const state = setup();
  const provider = makeProvider("provider:class-bound", "compute.bound.v1");
  await state.coordinator.registerProvider({ commitment: provider.commitment, publicKeyPem: provider.signer.publicKeyPem, apiToken: "bound-provider-token-at-least-32-characters" });
  await queue(state, "bound", 0, ["compute.bound.v1", "compute.other.v1"]);
  const job = await state.coordinator.claim(provider.signer.serviceId);
  const result = { ok: true };
  const wrongClassReceipt = createExecutionReceipt({ signer: provider.signer, job, result, resourceClass: "compute.other.v1", now });
  await assert.rejects(state.coordinator.complete(provider.signer.serviceId, job.job_id, { result, receipt: wrongClassReceipt }), /failed verification/);
  assert.equal(state.registry.redemption(job.redemption_id).status, "locked");
});
