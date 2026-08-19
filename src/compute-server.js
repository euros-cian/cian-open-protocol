// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.
import { createHash, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

const MAX_BODY_BYTES = 131_072;
const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

function tokenEqual(expected, supplied) {
  if (typeof expected !== "string" || typeof supplied !== "string") return false;
  const left = createHash("sha256").update(expected).digest();
  const right = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(left, right);
}

async function readJson(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers["content-type"] ?? "")) throw Object.assign(new Error("application/json content type required"), { status: 415 });
  const chunks=[]; let size=0;
  for await (const chunk of request) { size+=chunk.length; if(size>MAX_BODY_BYTES)throw Object.assign(new Error("request body too large"),{status:413});chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw Object.assign(new Error("invalid JSON"),{status:400}); }
}

function send(response,status,body,extraHeaders={}) {
  response.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","x-frame-options":"DENY","referrer-policy":"no-referrer",...extraHeaders});
  response.end(status===204?undefined:JSON.stringify(body));
}
function bearer(request){return /^Bearer (.+)$/.exec(request.headers.authorization??"")?.[1];}
function publicJob(job){if(!job)return null;const{workload:_workload,...safe}=job;return safe;}

class FixedWindowLimiter {
  constructor({windowMs=60_000,maxRequests=120,now=()=>Date.now()}={}){if(!Number.isSafeInteger(windowMs)||windowMs<1||!Number.isSafeInteger(maxRequests)||maxRequests<1)throw new Error("invalid rate-limit configuration");this.windowMs=windowMs;this.maxRequests=maxRequests;this.now=now;this.buckets=new Map();}
  take(key){const now=this.now();let bucket=this.buckets.get(key);if(!bucket||now>=bucket.resetAt){bucket={count:0,resetAt:now+this.windowMs};this.buckets.set(key,bucket);}bucket.count+=1;return{allowed:bucket.count<=this.maxRequests,retryAfter:Math.max(1,Math.ceil((bucket.resetAt-now)/1000))};}
}

export function createComputePoolServer({coordinator,store,adminToken,rateLimit,allowInsecureRemote=false}={}) {
  if(!coordinator||!store||typeof adminToken!=="string"||adminToken.length<12)throw new Error("coordinator, store and an admin token of at least 12 characters are required");
  const limiter=new FixedWindowLimiter(rateLimit);
  const server=createServer(async(request,response)=>{try{
    const url=new URL(request.url,`http://${request.headers.host??"127.0.0.1"}`);
    const limit=limiter.take(`${request.socket.remoteAddress??"unknown"}:${url.pathname}`);
    if(!limit.allowed)return send(response,429,{error:"request rate limit exceeded",code:"RATE_LIMITED"},{"retry-after":String(limit.retryAfter)});
    const requireAdmin=()=>{if(!tokenEqual(adminToken,bearer(request)))throw Object.assign(new Error("admin authorisation required"),{status:401});};
    if(request.method==="GET"&&url.pathname==="/health")return send(response,200,{status:"ok",protocol_version:"0.1",role:"compute-pool"});
    if(request.method==="GET"&&url.pathname==="/v0.1/compute/admin/operations"){requireAdmin();return send(response,200,await coordinator.operations());}
    if(request.method==="POST"&&url.pathname==="/v0.1/compute/providers/register"){requireAdmin();return send(response,201,await coordinator.registerProvider(await readJson(request)));}
    const suspend=/^\/v0\.1\/compute\/admin\/providers\/([^/]+)\/suspend$/.exec(url.pathname);
    if(request.method==="POST"&&suspend){requireAdmin();const body=await readJson(request);return send(response,200,await coordinator.suspendProvider(decodeURIComponent(suspend[1]),body.reason_code));}
    const resume=/^\/v0\.1\/compute\/admin\/providers\/([^/]+)\/resume$/.exec(url.pathname);
    if(request.method==="POST"&&resume){requireAdmin();return send(response,200,await coordinator.resumeProvider(decodeURIComponent(resume[1])));}
    const rotate=/^\/v0\.1\/compute\/admin\/providers\/([^/]+)\/rotate-token$/.exec(url.pathname);
    if(request.method==="POST"&&rotate){requireAdmin();const body=await readJson(request);return send(response,200,await coordinator.rotateProviderToken(decodeURIComponent(rotate[1]),body.api_token));}
    if(request.method==="POST"&&url.pathname==="/v0.1/compute/jobs"){const body=await readJson(request);return send(response,201,publicJob(await coordinator.enqueue({redemptionId:body.redemption_id,workload:body.workload})));}
    const claim=/^\/v0\.1\/compute\/providers\/([^/]+)\/claim$/.exec(url.pathname);
    if(request.method==="POST"&&claim){const providerId=decodeURIComponent(claim[1]);if(!await store.authenticate(providerId,bearer(request)??""))throw Object.assign(new Error("provider authorisation required"),{status:401});const job=await coordinator.claim(providerId);return job?send(response,200,job):send(response,204,{});}
    const complete=/^\/v0\.1\/compute\/providers\/([^/]+)\/jobs\/([^/]+)\/complete$/.exec(url.pathname);
    if(request.method==="POST"&&complete){const providerId=decodeURIComponent(complete[1]),jobId=decodeURIComponent(complete[2]);if(!await store.authenticate(providerId,bearer(request)??""))throw Object.assign(new Error("provider authorisation required"),{status:401});return send(response,200,await coordinator.complete(providerId,jobId,await readJson(request)));}
    const fail=/^\/v0\.1\/compute\/providers\/([^/]+)\/jobs\/([^/]+)\/fail$/.exec(url.pathname);
    if(request.method==="POST"&&fail){const providerId=decodeURIComponent(fail[1]),jobId=decodeURIComponent(fail[2]);if(!await store.authenticate(providerId,bearer(request)??""))throw Object.assign(new Error("provider authorisation required"),{status:401});return send(response,200,await coordinator.fail(providerId,jobId,await readJson(request)));}
    const getJob=/^\/v0\.1\/compute\/jobs\/([^/]+)$/.exec(url.pathname);if(request.method==="GET"&&getJob){const job=await store.job(decodeURIComponent(getJob[1]));return job?send(response,200,publicJob(job)):send(response,404,{error:"job not found",code:"NOT_FOUND"});}
    return send(response,404,{error:"route not found",code:"NOT_FOUND"});
  }catch(error){const status=error.status??(/not found/.test(error.message)?404:/already|not running|not locked/.test(error.message)?409:400);return send(response,status,{error:error.message,code:status===401?"UNAUTHORISED":status===404?"NOT_FOUND":status===409?"CONFLICT":status===413?"PAYLOAD_TOO_LARGE":status===415?"UNSUPPORTED_MEDIA_TYPE":"BAD_REQUEST"});}});
  return{server,async listen({host="127.0.0.1",port=0}={}){if(!allowInsecureRemote&&!LOOPBACK.has(host))throw new Error("plain HTTP compute service may bind only to loopback; use TLS termination for network exposure");await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(port,host,resolve);});const address=server.address();return`http://${address.address}:${address.port}`;},async close(){if(server.listening)await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}};
}
