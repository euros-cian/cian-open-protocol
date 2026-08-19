import { randomBytes } from "node:crypto";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import {
  ComputeCoordinator, PostgresComputeJobStore, PostgresSandboxStore,
  PostgresSettlementRegistry, createComputePoolServer, createPublicSandboxServer,
  createRegistryServer
} from "../src/index.js";

const required=["CIAN_SANDBOX_DATABASE_URL","CIAN_SANDBOX_ADMIN_TOKEN","CIAN_SANDBOX_KEY_PASSPHRASE"];
const missing=required.filter(name=>!process.env[name]);if(missing.length)throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
const credentialsPath=process.env.CIAN_SANDBOX_CREDENTIALS??"./secrets/sandbox-registry.credentials.json";
mkdirSync(dirname(credentialsPath),{recursive:true,mode:0o700});
const registry=await PostgresSettlementRegistry.connect({connectionString:process.env.CIAN_SANDBOX_DATABASE_URL,registryId:"registry:cian:public-sandbox"});
const internalRegistryToken=randomBytes(32).toString("base64url"),internalComputeToken=randomBytes(32).toString("base64url");
const registryService=createRegistryServer({registry,registryId:"registry:cian:public-sandbox",adminToken:internalRegistryToken,registryCredentialsPath:credentialsPath,registryPassphrase:process.env.CIAN_SANDBOX_KEY_PASSPHRASE});
const registryUrl=await registryService.listen({host:"127.0.0.1",port:0});
const computeStore=new PostgresComputeJobStore({pool:registry.pool});
const coordinator=new ComputeCoordinator({registry,store:computeStore,queueAlertThreshold:Number(process.env.CIAN_SANDBOX_QUEUE_ALERT_THRESHOLD??25)});
const computeService=createComputePoolServer({coordinator,store:computeStore,adminToken:internalComputeToken});
const computeUrl=await computeService.listen({host:"127.0.0.1",port:0});
const sandbox=createPublicSandboxServer({
  registry,computeCoordinator:coordinator,sandboxStore:new PostgresSandboxStore({pool:registry.pool}),registryUrl,computeUrl,
  adminToken:process.env.CIAN_SANDBOX_ADMIN_TOKEN,seriesId:process.env.CIAN_SANDBOX_SERIES_ID??"TB-CY-SANDBOX",
  grantAmount:Number(process.env.CIAN_SANDBOX_GRANT_AMOUNT??10),maxProviderCapacity:Number(process.env.CIAN_SANDBOX_MAX_PROVIDER_CAPACITY??100),
  rateLimit:{windowMs:60_000,maxRequests:Number(process.env.CIAN_SANDBOX_RATE_LIMIT??60)}
});
const address=await sandbox.listen({host:process.env.HOST??"0.0.0.0",port:Number(process.env.PORT??8787)});
console.log(`Cian public developer sandbox listening at ${address}`);
console.log("Synthetic demonstration To Bach only. No monetary value. No OpenAI service or personal data.");
const close=async()=>{await sandbox.close();await computeService.close();await registryService.close();await registry.close();process.exit(0);};
process.once("SIGINT",close);process.once("SIGTERM",close);
