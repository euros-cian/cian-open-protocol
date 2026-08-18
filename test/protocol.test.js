import test from "node:test";
import assert from "node:assert/strict";
import {
  SettlementRegistry, allocateProRata, digest, epochBudget,
  generateAgentKeys, recognisedCapacity, signRecord, verifyRecord
} from "../src/index.js";

const fixedNow = new Date("2026-09-24T13:00:00Z");
const future = "2026-09-24T14:00:00Z";

test("Ed25519 signatures cover canonical record content", () => {
  const { publicKey, privateKey } = generateAgentKeys();
  const signed = signRecord({ protocol_version: "0.1", agent_id: "agent:A", sequence: 0 }, privateKey, "key:A:1");
  assert.equal(verifyRecord(signed, publicKey), true);
  assert.equal(verifyRecord({ ...signed, sequence: 1 }, publicKey), false);
  assert.match(digest({ b: 2, a: 1 }), /^sha256:[0-9a-f]{64}$/);
});

test("risk adjustment and epoch budget use bounded integer arithmetic", () => {
  const commitment = { nominal_capacity: 1000, assurance_ppm: 900000, availability_ppm: 900000, reserve_ppm: 800000 };
  assert.equal(recognisedCapacity(commitment), 648);
  assert.equal(epochBudget([commitment], 2), 324);
});

test("largest-remainder allocation is deterministic and never exceeds backing", () => {
  const proofs = [
    { proof_id: "proof:c", recipient_agent_id: "agent:C", weight: 1 },
    { proof_id: "proof:a", recipient_agent_id: "agent:A", weight: 1 },
    { proof_id: "proof:b", recipient_agent_id: "agent:B", weight: 1 }
  ];
  const allocations = allocateProRata(proofs, 2);
  assert.deepEqual(allocations.map(item => item.amount), [0, 1, 1]);
  assert.equal(allocations.reduce((sum, item) => sum + item.amount, 0), 2);
});

function setupRegistry() {
  const registry = new SettlementRegistry({ now: () => fixedNow, verifySignature: request => request.signature === "valid" });
  registry.registerAgent("agent:A");
  registry.registerAgent("agent:B");
  registry.allocate({ seriesId: "TB-CY-2026-09", allocations: [{ proof_id: "proof:1", recipient_agent_id: "agent:A", amount: 10 }] });
  return registry;
}

test("allocation consumes each proof once", () => {
  const registry = setupRegistry();
  assert.throws(() => registry.allocate({ seriesId: "TB-CY-2026-09", allocations: [{ proof_id: "proof:1", recipient_agent_id: "agent:A", amount: 1 }] }), /consumed/);
  assert.equal(registry.balance("agent:A", "TB-CY-2026-09").balance, 10);
});

test("atomic transfer moves balance and rejects replay and conflicting spend", () => {
  const registry = setupRegistry();
  const request = {
    transfer_id: "tx:1", series_id: "TB-CY-2026-09", from_agent: "agent:A", to_agent: "agent:B",
    amount: 8, sender_sequence: 0, nonce: "nonce-000000000001", expires_at: future, signature: "valid"
  };
  const receipt = registry.transfer(request);
  assert.equal(receipt.status, "final");
  assert.equal(registry.balance("agent:A", request.series_id).balance, 2);
  assert.equal(registry.balance("agent:B", request.series_id).balance, 8);
  assert.throws(() => registry.transfer(request), /replayed/);
  assert.throws(() => registry.transfer({ ...request, transfer_id: "tx:2", nonce: "nonce-000000000002" }), /sequence|insufficient/);
  assert.equal(registry.balance("agent:A", request.series_id).balance, 2);
});

test("uncredentialed and expired transfers make no state change", () => {
  const registry = setupRegistry();
  const base = { transfer_id: "tx:x", series_id: "TB-CY-2026-09", from_agent: "agent:A", amount: 1, sender_sequence: 0, nonce: "nonce-000000000003", expires_at: future, signature: "valid" };
  assert.throws(() => registry.transfer({ ...base, to_agent: "human:euros" }), /credentialed/);
  assert.throws(() => registry.transfer({ ...base, to_agent: "agent:B", expires_at: "2026-09-24T12:00:00Z" }), /expired/);
  assert.equal(registry.balance("agent:A", base.series_id).balance, 10);
});

test("redemption locks then irreversibly retires without crediting provider", () => {
  const registry = setupRegistry();
  registry.registerAgent("agent:provider");
  registry.lockRedemption({
    redemption_id: "red:1", holder_agent: "agent:A", series_id: "TB-CY-2026-09", amount: 4,
    sender_sequence: 0, nonce: "nonce-000000000004", expires_at: future, signature: "valid"
  });
  assert.deepEqual(registry.balance("agent:A", "TB-CY-2026-09"), { balance: 10, locked: 4, sequence: 1 });
  const retirement = registry.retire("red:1", { redemption_id: "red:1", provider_id: "provider:1", status: "verified" });
  assert.equal(retirement.status, "permanently_retired");
  assert.deepEqual(registry.balance("agent:A", "TB-CY-2026-09"), { balance: 6, locked: 0, sequence: 1 });
  assert.equal(registry.balance("agent:provider", "TB-CY-2026-09").balance, 0);
  assert.throws(() => registry.retire("red:1", { redemption_id: "red:1", status: "verified" }), /not locked/);
});

