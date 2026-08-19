import test from "node:test";
import assert from "node:assert/strict";
import { ComputePool, LocalComputeProvider, SettlementRegistry, createRegistryServer, createSigningService, digest, verifyRecord, importPublicKey } from "../src/index.js";

const now = () => new Date("2026-08-19T12:00:00Z");
function setup() {
  const registry = new SettlementRegistry({ now, verifySignature: request => request.signature === "valid" });
  registry.registerAgent("agent:holder");
  registry.allocate({ seriesId: "TB-CY-COMPUTE", allocations: [{ proof_id: "proof:compute", recipient_agent_id: "agent:holder", amount: 3 }] });
  const signer = createSigningService({ serviceId: "provider:local-safe" });
  const provider = new LocalComputeProvider({ signer, now });
  const pool = new ComputePool({ registry, now });
  const commitment = provider.createCommitment({ nominalCapacity: 5, availableFrom: "2026-08-19T11:00:00Z", availableUntil: "2026-08-19T13:00:00Z" });
  pool.registerProvider({ commitment, publicKeyPem: signer.publicKeyPem, provider });
  return { registry, signer, provider, pool, commitment };
}

test("safe compute consumes locked To Bach and produces a verified signed receipt", async () => {
  const { registry, signer, pool } = setup();
  const workload = { kind: "sha256", text: "Bore da, Cian" };
  registry.lockRedemption({ redemption_id: "red:compute:1", holder_agent: "agent:holder", series_id: "TB-CY-COMPUTE", amount: 2, sender_sequence: 0, nonce: "nonce-compute-0001", workload_digest: digest(workload), resource_classes: ["local.safe-job.v1"], expires_at: "2026-08-19T13:00:00Z", signature: "valid" });
  const before = registry.ledgerSummary("TB-CY-COMPUTE");
  assert.deepEqual({ issued: before.issued_total, circulating: before.circulating_total, locked: before.locked_total, retired: before.retired_total }, { issued: 3, circulating: 3, locked: 2, retired: 0 });
  const execution = await pool.execute({ redemptionId: "red:compute:1", workload });
  assert.equal(verifyRecord(execution.receipt, importPublicKey(signer.publicKeyPem)), true);
  assert.equal(execution.result.digest, digest(workload.text));
  assert.equal(execution.retirement.status, "permanently_retired");
  const after = registry.ledgerSummary("TB-CY-COMPUTE");
  assert.deepEqual({ issued: after.issued_total, circulating: after.circulating_total, locked: after.locked_total, retired: after.retired_total, valid: after.conservation_valid }, { issued: 3, circulating: 1, locked: 0, retired: 2, valid: true });
});

test("compute pool rejects non-allowlisted work without retiring To Bach", async () => {
  const { registry, pool, commitment } = setup();
  const workload = { kind: "execute-javascript", source: "dangerous()" };
  registry.lockRedemption({ redemption_id: "red:compute:2", holder_agent: "agent:holder", series_id: "TB-CY-COMPUTE", amount: 1, sender_sequence: 0, nonce: "nonce-compute-0002", workload_digest: digest(workload), resource_classes: ["local.safe-job.v1"], expires_at: "2026-08-19T13:00:00Z", signature: "valid" });
  await assert.rejects(pool.execute({ redemptionId: "red:compute:2", workload }), /not allowlisted/);
  assert.equal(registry.redemption("red:compute:2").status, "locked");
  assert.equal(pool.commitments().find(item => item.commitment_id === commitment.commitment_id).remaining_capacity, 5);
  assert.equal(registry.ledgerSummary("TB-CY-COMPUTE").retired_total, 0);
});

test("compute pool rejects a tampered capacity commitment", () => {
  const { signer, provider, commitment } = setup();
  const pool = new ComputePool({ registry: new SettlementRegistry(), now });
  assert.throws(() => pool.registerProvider({ commitment: { ...commitment, nominal_capacity: 5000 }, publicKeyPem: signer.publicKeyPem, provider }), /signature/);
});

test("registry exposes a signed authoritative To Bach ledger view", async t => {
  const registry = new SettlementRegistry();
  registry.registerAgent("agent:ledger");
  registry.allocate({ seriesId: "TB-CY-LEDGER", allocations: [{ proof_id: "proof:ledger", recipient_agent_id: "agent:ledger", amount: 7 }] });
  const service = createRegistryServer({ registry, adminToken: "test-admin" });
  t.after(() => service.close());
  const address = await service.listen();
  const response = await fetch(`${address}/v0.1/ledger?series_id=TB-CY-LEDGER`);
  assert.equal(response.status, 200);
  const ledger = await response.json();
  assert.equal(ledger.issued_total, 7);
  assert.equal(ledger.conservation_valid, true);
  assert.equal(verifyRecord(ledger, importPublicKey(service.signer.publicKeyPem)), true);
});
