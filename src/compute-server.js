// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.
import { createServer } from "node:http";
const MAX_BODY_BYTES=131_072;
async function readJson(request){const chunks=[];let size=0;for await(const chunk of request){size+=chunk.length;if(size>MAX_BODY_BYTES)throw Object.assign(new Error("request body too large"),{status:413});chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{throw Object.assign(new Error("invalid JSON"),{status:400});}}
function send(response,status,body){response.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"});response.end(JSON.stringify(body));}
function bearer(request){return /^Bearer (.+)$/.exec(request.headers.authorization??"")?.[1];}
function publicJob(job){if(!job)return null;const{workload:_workload,...safe}=job;return safe;}
export function createComputePoolServer({coordinator,store,adminToken}={}){
  if(!coordinator||!store||!adminToken)throw new Error("coordinator, store and admin token are required");
  const server=createServer(async(request,response)=>{try{const url=new URL(request.url,`http://${request.headers.host??"127.0.0.1"}`);
    if(request.method==="GET"&&url.pathname==="/health")return send(response,200,{status:"ok",protocol_version:"0.1",role:"compute-pool"});
    if(request.method==="POST"&&url.pathname==="/v0.1/compute/providers/register"){if(bearer(request)!==adminToken)throw Object.assign(new Error("admin authorisation required"),{status:401});return send(response,201,await coordinator.registerProvider(await readJson(request)));}
    if(request.method==="POST"&&url.pathname==="/v0.1/compute/jobs"){const body=await readJson(request);return send(response,201,publicJob(await coordinator.enqueue({redemptionId:body.redemption_id,workload:body.workload})));}
    const claim=/^\/v0\.1\/compute\/providers\/([^/]+)\/claim$/.exec(url.pathname);
    if(request.method==="POST"&&claim){const providerId=decodeURIComponent(claim[1]);if(!await store.authenticate(providerId,bearer(request)??""))throw Object.assign(new Error("provider authorisation required"),{status:401});const job=await coordinator.claim(providerId);return job?send(response,200,job):send(response,204,{});}
    const complete=/^\/v0\.1\/compute\/providers\/([^/]+)\/jobs\/([^/]+)\/complete$/.exec(url.pathname);
    if(request.method==="POST"&&complete){const providerId=decodeURIComponent(complete[1]),jobId=decodeURIComponent(complete[2]);if(!await store.authenticate(providerId,bearer(request)??""))throw Object.assign(new Error("provider authorisation required"),{status:401});return send(response,200,await coordinator.complete(providerId,jobId,await readJson(request)));}
    const fail=/^\/v0\.1\/compute\/providers\/([^/]+)\/jobs\/([^/]+)\/fail$/.exec(url.pathname);
    if(request.method==="POST"&&fail){const providerId=decodeURIComponent(fail[1]),jobId=decodeURIComponent(fail[2]);if(!await store.authenticate(providerId,bearer(request)??""))throw Object.assign(new Error("provider authorisation required"),{status:401});return send(response,200,await coordinator.fail(providerId,jobId,await readJson(request)));}
    const getJob=/^\/v0\.1\/compute\/jobs\/([^/]+)$/.exec(url.pathname);if(request.method==="GET"&&getJob){const job=await store.job(decodeURIComponent(getJob[1]));return job?send(response,200,publicJob(job)):send(response,404,{error:"job not found",code:"NOT_FOUND"});}
    return send(response,404,{error:"route not found",code:"NOT_FOUND"});
  }catch(error){const status=error.status??(/already|not running|not locked/.test(error.message)?409:400);return send(response,status,{error:error.message,code:status===401?"UNAUTHORISED":status===409?"CONFLICT":"BAD_REQUEST"});}});
  return{server,async listen({host="127.0.0.1",port=0}={}){await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(port,host,resolve);});const address=server.address();return`http://${address.address}:${address.port}`;},async close(){if(server.listening)await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}};
}
