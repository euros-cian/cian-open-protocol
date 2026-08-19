// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.
import { randomUUID } from "node:crypto";
import { digest, importPublicKey, verifyRecord } from "./crypto.js";
import { recognisedCapacity } from "./allocation.js";

export class ComputeCoordinator {
  constructor({ registry, store, now = () => new Date(), leaseMs = 30_000, maxAttempts = 3, queueAlertThreshold = 100 } = {}) {
    if (!registry?.redemption || !registry?.retire || !registry?.releaseRedemption) throw new Error("settlement registry with refund support is required");
    if (!store?.enqueue || !store?.claim) throw new Error("compute job store is required");
    this.registry=registry; this.store=store; this.now=now; this.leaseMs=leaseMs; this.maxAttempts=maxAttempts;this.queueAlertThreshold=queueAlertThreshold;
  }
  async registerProvider({ commitment, publicKeyPem, apiToken }) {
    if (typeof apiToken !== "string" || apiToken.length < 32) throw new Error("provider API token must contain at least 32 characters");
    if (!verifyRecord(commitment, importPublicKey(publicKeyPem))) throw new Error("invalid compute commitment signature");
    const from=new Date(commitment.available_from).getTime(), until=new Date(commitment.available_until).getTime(), now=this.now().getTime();
    if (commitment.protocol_version!=="0.1" || !Number.isFinite(from) || !Number.isFinite(until) || from>now || until<=now || until<=from) throw new Error("compute commitment is not currently available");
    const capacity=recognisedCapacity(commitment); if(capacity<1) throw new Error("compute commitment has no recognised capacity");
    return this.store.registerProvider({commitment,publicKeyPem,apiToken,recognisedCapacity:capacity});
  }
  async enqueue({ redemptionId, workload }) {
    const redemption=await this.registry.redemption(redemptionId);
    if(!redemption || redemption.status!=="locked") throw new Error("redemption is not locked");
    if(digest(workload)!==redemption.workload_digest) throw new Error("workload does not match locked redemption digest");
    return this.store.enqueue({redemption_id:redemptionId,holder_agent:redemption.holder_agent,series_id:redemption.series_id,amount:redemption.amount,resource_classes:redemption.resource_classes,workload_digest:redemption.workload_digest,workload,max_attempts:this.maxAttempts});
  }
  async claim(providerId){return this.store.claim(providerId,{leaseMs:this.leaseMs});}
  async suspendProvider(providerId,reasonCode){if(typeof reasonCode!=="string"||!/^[a-z0-9._-]{3,64}$/i.test(reasonCode))throw new Error("valid suspension reason_code is required");return this.store.suspendProvider(providerId,reasonCode);}
  async resumeProvider(providerId){return this.store.resumeProvider(providerId);}
  async operations(){const snapshot=await this.store.operations();const alerts=[];if(snapshot.jobs.queued>this.queueAlertThreshold)alerts.push({code:"QUEUE_BACKLOG",severity:"warning",count:snapshot.jobs.queued});if(snapshot.expired_leases>0)alerts.push({code:"EXPIRED_LEASES",severity:"critical",count:snapshot.expired_leases});const suspended=snapshot.providers.filter(provider=>provider.status==="suspended").length;if(suspended)alerts.push({code:"PROVIDERS_SUSPENDED",severity:"warning",count:suspended});return{protocol_version:"0.1",generated_at:this.now().toISOString(),...snapshot,alerts};}
  async complete(providerId,jobId,{result,receipt}){
    const job=await this.store.job(jobId); if(!job || job.status!=="running" || job.provider_id!==providerId) throw new Error("job is not running for provider");
    const provider=await this.store.provider(providerId);
    const commitment=await this.store.commitment(job.commitment_id);
    if(!provider || !commitment || commitment.commitment.provider_id!==providerId || commitment.commitment.resource_class!==receipt.resource_class || !verifyRecord(receipt,importPublicKey(provider.public_key)) || receipt.job_id!==jobId || receipt.redemption_id!==job.redemption_id || receipt.provider_id!==providerId || receipt.holder_agent!==job.holder_agent || !job.resource_classes.includes(receipt.resource_class) || receipt.metered_quantity!==job.amount || receipt.status!=="verified" || digest(result)!==receipt.result_digest) throw new Error("provider execution receipt failed verification");
    if(this.store.completeAndRetire) return this.store.completeAndRetire(jobId,providerId,{result,receipt});
    const retirement=await this.registry.retire(job.redemption_id,receipt); const completed=await this.store.complete(jobId,providerId,{result,receipt}); return {job:completed,retirement};
  }
  async fail(providerId,jobId,{reasonCode="provider_failure",retryable=true}={}){
    const outcome=await this.store.fail(jobId,providerId,{failure:{reason_code:reasonCode,recorded_at:this.now().toISOString()},retryable});
    if(outcome.action==="refund" && !this.store.atomicLedgerTransitions) outcome.refund=await this.registry.releaseRedemption(outcome.job.redemption_id,outcome.job.failure);
    return outcome;
  }
  async reapExpired(){const expired=await this.store.expiredRunning(this.now());const outcomes=[];for(const job of expired)outcomes.push(await this.fail(job.provider_id,job.job_id,{reasonCode:"lease_timeout",retryable:true}));return outcomes;}
}

export function createExecutionReceipt({ signer, job, result, resourceClass, now = () => new Date() }) {
  const completed=now().toISOString();
  return signer.sign({protocol_version:"0.1",receipt_id:`receipt:${randomUUID()}`,redemption_id:job.redemption_id,job_id:job.job_id,holder_agent:job.holder_agent,provider_id:signer.serviceId,resource_class:resourceClass,metered_quantity:job.amount,result_digest:digest(result),started_at:completed,completed_at:completed,status:"verified"});
}
