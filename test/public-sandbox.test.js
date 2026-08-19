import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { InMemorySandboxStore, SettlementRegistry, createPublicSandboxServer, createRegistryServer } from "../src/index.js";

test("public sandbox grants synthetic value once and supports emergency shutdown",async t=>{
  const directory=await mkdtemp(join(tmpdir(),"cian-sandbox-"));
  const registry=new SettlementRegistry();
  await registry.registerAgent({agent_id:"agent:test:one",public_key:"test",assurance_level:"A1"});
  const registryService=createRegistryServer({registry,adminToken:"internal-registry-token",registryCredentialsPath:join(directory,"registry.credentials.json"),registryPassphrase:"test passphrase"});
  const registryUrl=await registryService.listen();
  const computeServer=new (await import("node:http")).Server((_request,response)=>{response.writeHead(404,{"content-type":"application/json"});response.end("{}");});
  await new Promise(resolve=>computeServer.listen(0,"127.0.0.1",resolve));
  const computeUrl=`http://127.0.0.1:${computeServer.address().port}`;
  const sandboxStore=new InMemorySandboxStore();
  const service=createPublicSandboxServer({registry,computeCoordinator:{registerProvider(){throw new Error("not used");}},sandboxStore,registryUrl,computeUrl,adminToken:"sandbox-admin-token-at-least-32-characters"});
  const address=await service.listen();
  t.after(async()=>{await service.close();await registryService.close();await new Promise(resolve=>computeServer.close(resolve));await rm(directory,{recursive:true,force:true});});

  const first=await fetch(`${address}/sandbox/v0.1/faucet`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({agent_id:"agent:test:one"})});
  assert.equal(first.status,201);assert.equal((await first.json()).amount,10);
  assert.deepEqual(await registry.balance("agent:test:one","TB-CY-SANDBOX"),{balance:10,locked:0,sequence:0});
  const repeated=await fetch(`${address}/sandbox/v0.1/faucet`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({agent_id:"agent:test:one"})});
  assert.equal(repeated.status,409);
  const disabled=await fetch(`${address}/sandbox/v0.1/admin/state`,{method:"POST",headers:{authorization:"Bearer sandbox-admin-token-at-least-32-characters","content-type":"application/json"},body:'{"enabled":false}'});
  assert.equal(disabled.status,200);
  assert.equal((await fetch(`${address}/health`).then(r=>r.json())).sandbox_enabled,false);
  assert.equal((await fetch(`${address}/v0.1`).then(r=>r.status)),503);
});
