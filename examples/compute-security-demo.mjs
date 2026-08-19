import { ComputeCoordinator, InMemoryComputeJobStore, LocalComputeProvider, SettlementRegistry, createComputePoolServer, createSigningService } from "../src/index.js";

const now=()=>new Date("2026-08-19T12:00:00Z");
const registry=new SettlementRegistry({now});
const signer=createSigningService({serviceId:"provider:demo:security"});
const provider=new LocalComputeProvider({signer,now});
const store=new InMemoryComputeJobStore({now});
const coordinator=new ComputeCoordinator({registry,store,now});
const oldToken="demo-old-provider-token-at-least-32-characters";
const newToken="demo-new-provider-token-at-least-32-characters";
const commitment=provider.createCommitment({nominalCapacity:2,availableFrom:"2026-08-19T11:00:00Z",availableUntil:"2026-08-19T13:00:00Z"});
await coordinator.registerProvider({commitment,publicKeyPem:signer.publicKeyPem,apiToken:oldToken});
const service=createComputePoolServer({coordinator,store,adminToken:"demo-security-admin-token",rateLimit:{windowMs:60_000,maxRequests:2}});
const url=await service.listen();
try{
  await fetch(`${url}/v0.1/compute/admin/providers/${encodeURIComponent(signer.serviceId)}/rotate-token`,{method:"POST",headers:{authorization:"Bearer demo-security-admin-token","content-type":"application/json"},body:JSON.stringify({api_token:newToken})});
  const claimUrl=`${url}/v0.1/compute/providers/${encodeURIComponent(signer.serviceId)}/claim`;
  const oldStatus=(await fetch(claimUrl,{method:"POST",headers:{authorization:`Bearer ${oldToken}`}})).status;
  const newStatus=(await fetch(claimUrl,{method:"POST",headers:{authorization:`Bearer ${newToken}`}})).status;
  await fetch(`${url}/health`);await fetch(`${url}/health`);const limited=await fetch(`${url}/health`);
  console.log("Old token status",oldStatus,"New token status",newStatus,"Rate-limit status",limited.status);
  if(oldStatus!==401||newStatus!==204||limited.status!==429)throw new Error("security controls did not behave as required");
  console.log("MILESTONE_23_PASS");
}finally{await service.close();}
