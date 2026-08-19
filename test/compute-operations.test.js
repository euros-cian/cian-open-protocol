import test from "node:test";
import assert from "node:assert/strict";
import { ComputeCoordinator, InMemoryComputeJobStore, LocalComputeProvider, SettlementRegistry, createComputePoolServer, createExecutionReceipt, createSigningService, digest } from "../src/index.js";

function setup() {
  let current = new Date("2026-08-19T12:00:00Z");
  const now = () => new Date(current);
  const registry = new SettlementRegistry({ now, verifySignature: request => request.signature === "valid" });
  registry.registerAgent("agent:operations-holder");
  registry.allocate({ seriesId: "TB-CY-OPERATIONS", allocations: [{ proof_id: "proof:operations", recipient_agent_id: "agent:operations-holder", amount: 4 }] });
  const signer = createSigningService({ serviceId: "provider:operations:test" });
  const provider = new LocalComputeProvider({ signer, now });
  const store = new InMemoryComputeJobStore({ now });
  const coordinator = new ComputeCoordinator({ registry, store, now, leaseMs: 1000, queueAlertThreshold: 0 });
  const commitment = provider.createCommitment({ nominalCapacity: 4, availableFrom: "2026-08-19T11:00:00Z", availableUntil: "2026-08-19T13:00:00Z" });
  return { registry, signer, provider, store, coordinator, commitment, advance: value => { current = new Date(value); } };
}

async function queue(state, suffix, sequence) {
  const workload = { kind: "sha256", text: `Operations ${suffix}` };
  state.registry.lockRedemption({ redemption_id: `red:operations:${suffix}`, holder_agent: "agent:operations-holder", series_id: "TB-CY-OPERATIONS", amount: 1, sender_sequence: sequence, nonce: `nonce-operations-${suffix.padStart(6, "0")}`, workload_digest: digest(workload), resource_classes: [state.provider.resourceClass], expires_at: "2026-08-19T13:00:00Z", signature: "valid" });
  return state.coordinator.enqueue({ redemptionId: `red:operations:${suffix}`, workload });
}

test("suspension stops new claims but permits a valid in-flight completion", async () => {
  const state = setup();
  await state.coordinator.registerProvider({ commitment: state.commitment, publicKeyPem: state.signer.publicKeyPem, apiToken: "operations-provider-token-32-characters" });
  await queue(state, "1", 0); await queue(state, "2", 1);
  const running = await state.coordinator.claim(state.signer.serviceId);
  await state.coordinator.suspendProvider(state.signer.serviceId, "incident_review");
  assert.equal(await state.coordinator.claim(state.signer.serviceId), null);
  const result = { ok: true };
  const receipt = createExecutionReceipt({ signer: state.signer, job: running, result, resourceClass: state.provider.resourceClass });
  assert.equal((await state.coordinator.complete(state.signer.serviceId, running.job_id, { result, receipt })).job.status, "completed");
  const suspended = await state.coordinator.operations();
  assert.ok(suspended.alerts.some(alert => alert.code === "PROVIDERS_SUSPENDED"));
  assert.deepEqual(suspended.recent_events.map(event => event.event_type), ["provider_suspended"]);
  await state.coordinator.resumeProvider(state.signer.serviceId);
  assert.ok(await state.coordinator.claim(state.signer.serviceId));
});

test("operations snapshot raises backlog and expired-lease alerts without workloads", async () => {
  const state = setup();
  await state.coordinator.registerProvider({ commitment: state.commitment, publicKeyPem: state.signer.publicKeyPem, apiToken: "operations-provider-token-32-characters" });
  await queue(state, "3", 0); await queue(state, "4", 1);
  await state.coordinator.claim(state.signer.serviceId);
  state.advance("2026-08-19T12:00:02Z");
  const snapshot = await state.coordinator.operations();
  assert.ok(snapshot.alerts.some(alert => alert.code === "QUEUE_BACKLOG"));
  assert.ok(snapshot.alerts.some(alert => alert.code === "EXPIRED_LEASES"));
  assert.equal(JSON.stringify(snapshot).includes("Operations 3"), false);
});

test("operations and suspension HTTP routes require admin authorisation", async t => {
  const state = setup();
  await state.coordinator.registerProvider({ commitment: state.commitment, publicKeyPem: state.signer.publicKeyPem, apiToken: "operations-provider-token-32-characters" });
  const service = createComputePoolServer({ coordinator: state.coordinator, store: state.store, adminToken: "operations-admin-token" });
  t.after(() => service.close());
  const url = await service.listen();
  assert.equal((await fetch(`${url}/v0.1/compute/admin/operations`)).status, 401);
  const suspended = await fetch(`${url}/v0.1/compute/admin/providers/${encodeURIComponent(state.signer.serviceId)}/suspend`, { method: "POST", headers: { authorization: "Bearer operations-admin-token", "content-type": "application/json" }, body: JSON.stringify({ reason_code: "operator_request" }) });
  assert.equal(suspended.status, 200);
  const dashboard = await fetch(`${url}/v0.1/compute/admin/operations`, { headers: { authorization: "Bearer operations-admin-token" } });
  assert.equal((await dashboard.json()).providers[0].status, "suspended");
});
