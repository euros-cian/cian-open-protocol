// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { recognisedCapacity } from "./allocation.js";

const MAX_BODY_BYTES = 131_072;
function equalToken(expected, supplied) {
  if (typeof expected !== "string" || typeof supplied !== "string") return false;
  const a=createHash("sha256").update(expected).digest(),b=createHash("sha256").update(supplied).digest();
  return timingSafeEqual(a,b);
}
function send(response,status,body,headers={}){response.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","x-frame-options":"DENY","referrer-policy":"no-referrer",...headers});response.end(status===204?undefined:JSON.stringify(body));}
async function bodyBuffer(request){const chunks=[];let size=0;for await(const chunk of request){size+=chunk.length;if(size>MAX_BODY_BYTES)throw Object.assign(new Error("request body too large"),{status:413});chunks.push(chunk);}return Buffer.concat(chunks);}
function json(buffer){try{return JSON.parse(buffer.toString("utf8"));}catch{throw Object.assign(new Error("invalid JSON"),{status:400});}}

class Limiter{constructor({windowMs=60_000,maxRequests=60,now=()=>Date.now()}={}){this.windowMs=windowMs;this.maxRequests=maxRequests;this.now=now;this.buckets=new Map();}take(key){const now=this.now();let b=this.buckets.get(key);if(!b||now>=b.reset){b={count:0,reset:now+this.windowMs};this.buckets.set(key,b);}b.count++;return{allowed:b.count<=this.maxRequests,retry:Math.max(1,Math.ceil((b.reset-now)/1000))};}}

export function createPublicSandboxServer({registry,computeCoordinator,sandboxStore,registryUrl,computeUrl,adminToken,seriesId="TB-CY-SANDBOX",grantAmount=10,maxProviderCapacity=100,rateLimit}={}){
  if(!registry||!computeCoordinator||!sandboxStore||!registryUrl||!computeUrl||typeof adminToken!=="string"||adminToken.length<32)throw new Error("sandbox dependencies and an admin token of at least 32 characters are required");
  const limiter=new Limiter(rateLimit);
  const server=createServer(async(request,response)=>{try{
    const url=new URL(request.url,`http://${request.headers.host??"localhost"}`),client=request.socket.remoteAddress??"unknown";
    const limit=limiter.take(`${client}:${url.pathname}`);if(!limit.allowed)return send(response,429,{error:"sandbox rate limit exceeded",code:"RATE_LIMITED"},{"retry-after":String(limit.retry)});
    if(request.method==="GET"&&url.pathname==="/health")return send(response,200,{status:"ok",protocol_version:"0.1",role:"public-developer-sandbox",sandbox_enabled:await sandboxStore.isEnabled(),series_id:seriesId});
    if(request.method==="POST"&&url.pathname==="/sandbox/v0.1/admin/state"){
      const supplied=/^Bearer (.+)$/.exec(request.headers.authorization??"")?.[1];if(!equalToken(adminToken,supplied))throw Object.assign(new Error("admin authorisation required"),{status:401});
      const payload=json(await bodyBuffer(request));return send(response,200,{sandbox_enabled:await sandboxStore.setEnabled(payload.enabled===true)});
    }
    if(!await sandboxStore.isEnabled())return send(response,503,{error:"sandbox is temporarily disabled",code:"SANDBOX_DISABLED"},{"retry-after":"300"});
    if(request.method==="POST"&&url.pathname==="/sandbox/v0.1/faucet"){
      const payload=json(await bodyBuffer(request));if(typeof payload.agent_id!=="string"||!await registry.agent(payload.agent_id))throw Object.assign(new Error("registered agent_id required"),{status:400});
      const proofId=`sandbox-grant:${randomUUID()}`,grant={agent_id:payload.agent_id,proof_id:proofId,series_id:seriesId,amount:grantAmount};
      if(!await sandboxStore.claimGrant(grant))throw Object.assign(new Error("sandbox grant already claimed"),{status:409});
      try { await registry.allocate({seriesId,allocations:[{proof_id:proofId,recipient_agent_id:payload.agent_id,amount:grantAmount}]}); }
      catch(error) { await sandboxStore.releaseGrant?.(payload.agent_id); throw error; }
      return send(response,201,{status:"allocated",...grant,notice:"Synthetic demonstration To Bach only; no monetary value."});
    }
    if(request.method==="POST"&&url.pathname==="/sandbox/v0.1/providers/register"){
      const payload=json(await bodyBuffer(request)),capacity=recognisedCapacity(payload.commitment??{});
      if(capacity<1||capacity>maxProviderCapacity)throw Object.assign(new Error(`sandbox recognised capacity must be between 1 and ${maxProviderCapacity}`),{status:400});
      return send(response,201,await computeCoordinator.registerProvider(payload));
    }
    if(url.pathname.startsWith("/v0.1/admin/")||url.pathname==="/v0.1/compute/providers/register"||url.pathname.startsWith("/v0.1/compute/admin/"))return send(response,404,{error:"route not found",code:"NOT_FOUND"});
    const target=url.pathname.startsWith("/v0.1/compute/")?computeUrl:registryUrl;
    const body=request.method==="GET"||request.method==="HEAD"?undefined:await bodyBuffer(request);
    const headers={...request.headers};delete headers.host;delete headers["content-length"];
    const upstream=await fetch(`${target}${url.pathname}${url.search}`,{method:request.method,headers,body,redirect:"manual"});
    const outgoing={};for(const [key,value]of upstream.headers)if(!["connection","keep-alive","transfer-encoding"].includes(key))outgoing[key]=value;
    response.writeHead(upstream.status,outgoing);response.end(Buffer.from(await upstream.arrayBuffer()));
  }catch(error){const status=error.status??(/already/.test(error.message)?409:400);return send(response,status,{error:error.message,code:status===401?"UNAUTHORISED":status===409?"CONFLICT":status===413?"PAYLOAD_TOO_LARGE":"BAD_REQUEST"});}});
  return{server,async listen({host="127.0.0.1",port=0}={}){await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(port,host,resolve);});const a=server.address();return`http://${a.address}:${a.port}`;},async close(){if(server.listening)await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}};
}
