import test from "node:test";
import assert from "node:assert/strict";
import { AgentClient, createRegistryServer, digest } from "../src/index.js";

async function adminPost(baseUrl, path, token, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error);
  return payload;
}

test("two agents complete allocation, transfer, replay rejection and compute retirement", async t => {
  const adminToken = "test-admin-token";
  const service = createRegistryServer({ adminToken });
  const registryUrl = await service.listen();
  t.after(() => service.close());

  const agentA = AgentClient.create({
    registryUrl, endpoint: "https://agent-a.example", capabilities: ["orchestration"]
  });
  const agentB = AgentClient.create({
    registryUrl, endpoint: "https://agent-b.example", capabilities: ["image-analysis"]
  });
  assert.equal((await agentA.register()).status, "registered");
  assert.equal((await agentB.register()).status, "registered");

  const seriesId = "TB-CY-2026-09-DEMO";
  await adminPost(registryUrl, "/v0.1/admin/allocations", adminToken, {
    seriesId,
    allocations: [{ proof_id: "proof:demo:1", recipient_agent_id: agentA.agentId, amount: 10 }]
  });
  assert.equal((await agentA.getBalance(seriesId)).balance, 10);

  const { request, receipt } = await agentA.transfer({
    recipient: agentB.agentId, seriesId, amount: 4, taskId: "image-analysis-784"
  });
  assert.equal(receipt.status, "final");
  assert.equal((await agentA.getBalance(seriesId)).balance, 6);
  assert.equal((await agentB.getBalance(seriesId)).balance, 4);

  const replay = await fetch(`${registryUrl}/v0.1/transfers`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request)
  });
  assert.equal(replay.status, 409);
  assert.equal((await replay.json()).code, "CONFLICT");
  assert.equal((await agentA.getBalance(seriesId)).balance, 6);

  const { request: redemption, lock } = await agentB.redeem({
    seriesId, amount: 4, workload: digest({ task: "image-analysis", input: "sha256:demo" })
  });
  assert.equal(lock.status, "locked");
  assert.equal((await agentB.getBalance(seriesId)).locked, 4);

  const retirement = await adminPost(
    registryUrl,
    `/v0.1/admin/redemptions/${encodeURIComponent(redemption.redemption_id)}/retire`,
    adminToken,
    { redemption_id: redemption.redemption_id, receipt_id: "exec:demo:1", provider_id: "provider:demo", status: "verified" }
  );
  assert.equal(retirement.status, "permanently_retired");
  assert.deepEqual(
    await agentB.getBalance(seriesId),
    { agent_id: agentB.agentId, series_id: seriesId, balance: 0, locked: 0, sequence: 1 }
  );

  const auditResponse = await fetch(`${registryUrl}/v0.1/audit`);
  const audit = await auditResponse.json();
  assert.deepEqual(audit.events.map(event => event.type), [
    "allocation", "transfer", "redemption_locked", "retirement"
  ]);
});

