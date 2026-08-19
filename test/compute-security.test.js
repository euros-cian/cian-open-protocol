import test from "node:test";
import assert from "node:assert/strict";
import { ComputeCoordinator, InMemoryComputeJobStore, LocalComputeProvider, SettlementRegistry, createComputePoolServer, createSigningService } from "../src/index.js";

const now = () => new Date("2026-08-19T12:00:00Z");
async function setup(options={}) {
  const registry = new SettlementRegistry({ now });
  const signer = createSigningService({ serviceId: "provider:security:test" });
  const provider = new LocalComputeProvider({ signer, now });
  const store = new InMemoryComputeJobStore({ now });
  const coordinator = new ComputeCoordinator({ registry, store, now });
  const oldToken = "old-security-provider-token-32-characters";
  const commitment = provider.createCommitment({ nominalCapacity: 2, availableFrom: "2026-08-19T11:00:00Z", availableUntil: "2026-08-19T13:00:00Z" });
  await coordinator.registerProvider({ commitment, publicKeyPem: signer.publicKeyPem, apiToken: oldToken });
  const service = createComputePoolServer({ coordinator, store, adminToken: "security-admin-token", ...options });
  return { signer, store, coordinator, service, oldToken };
}

test("provider token rotation immediately invalidates the old token", async t => {
  const state = await setup(); t.after(() => state.service.close()); const url=await state.service.listen();
  const newToken="new-security-provider-token-32-characters";
  const rotated=await fetch(`${url}/v0.1/compute/admin/providers/${encodeURIComponent(state.signer.serviceId)}/rotate-token`,{method:"POST",headers:{authorization:"Bearer security-admin-token","content-type":"application/json"},body:JSON.stringify({api_token:newToken})});
  assert.equal(rotated.status,200);
  const claimUrl=`${url}/v0.1/compute/providers/${encodeURIComponent(state.signer.serviceId)}/claim`;
  assert.equal((await fetch(claimUrl,{method:"POST",headers:{authorization:`Bearer ${state.oldToken}`}})).status,401);
  assert.equal((await fetch(claimUrl,{method:"POST",headers:{authorization:`Bearer ${newToken}`}})).status,204);
  assert.equal((await state.coordinator.operations()).recent_events[0].event_type,"provider_token_rotated");
});

test("compute API rate limits repeated requests and returns retry-after", async t => {
  const state=await setup({rateLimit:{windowMs:60_000,maxRequests:2}});t.after(()=>state.service.close());const url=await state.service.listen();
  assert.equal((await fetch(`${url}/health`)).status,200);assert.equal((await fetch(`${url}/health`)).status,200);
  const limited=await fetch(`${url}/health`);assert.equal(limited.status,429);assert.ok(Number(limited.headers.get("retry-after"))>=1);
});

test("compute API rejects unsafe media, oversized bodies and remote plain HTTP", async t => {
  const state=await setup();t.after(()=>state.service.close());
  await assert.rejects(state.service.listen({host:"0.0.0.0"}),/TLS termination/);
  const url=await state.service.listen();
  assert.equal((await fetch(`${url}/v0.1/compute/jobs`,{method:"POST",body:"{}"})).status,415);
  assert.equal((await fetch(`${url}/v0.1/compute/jobs`,{method:"POST",headers:{"content-type":"application/json"},body:"{"})).status,400);
  assert.equal((await fetch(`${url}/v0.1/compute/jobs`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({padding:"x".repeat(132_000)})})).status,413);
});
