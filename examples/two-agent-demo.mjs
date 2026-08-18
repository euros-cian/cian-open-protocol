import { AgentClient, createRegistryServer, digest } from "../src/index.js";

const adminToken = "local-demo-only";
const service = createRegistryServer({ adminToken });
const registryUrl = await service.listen();

async function adminPost(path, body) {
  const response = await fetch(`${registryUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${adminToken}` },
    body: JSON.stringify(body)
  });
  return response.json();
}

try {
  const agentA = AgentClient.create({ registryUrl, endpoint: "http://agent-a.local", capabilities: ["orchestration"] });
  const agentB = AgentClient.create({ registryUrl, endpoint: "http://agent-b.local", capabilities: ["analysis"] });
  await agentA.register();
  await agentB.register();

  const seriesId = "TB-CY-DEMO";
  await adminPost("/v0.1/admin/allocations", {
    seriesId, allocations: [{ proof_id: "proof:demo", recipient_agent_id: agentA.agentId, amount: 10 }]
  });
  console.log("Allocated", await agentA.getBalance(seriesId));

  const transfer = await agentA.transfer({ recipient: agentB.agentId, seriesId, amount: 4, taskId: "demo-analysis" });
  console.log("Transferred", transfer.receipt);

  const redemption = await agentB.redeem({ seriesId, amount: 4, workload: digest({ demo: true }) });
  console.log("Locked", redemption.lock);

  const retirement = await adminPost(`/v0.1/admin/redemptions/${encodeURIComponent(redemption.request.redemption_id)}/retire`, {
    redemption_id: redemption.request.redemption_id, receipt_id: "execution:demo", provider_id: "provider:demo", status: "verified"
  });
  console.log("Retired", retirement);
  console.log("Final balances", { agentA: await agentA.getBalance(seriesId), agentB: await agentB.getBalance(seriesId) });
} finally {
  await service.close();
}
