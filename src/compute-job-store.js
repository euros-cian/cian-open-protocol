// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.
import { randomUUID } from "node:crypto";
import { digest } from "./crypto.js";

function clone(value) { return value == null ? value : structuredClone(value); }
function rowJob(row) {
  if (!row) return null;
  return {
    job_id: row.job_id, redemption_id: row.redemption_id, holder_agent: row.holder_agent,
    series_id: row.series_id, amount: Number(row.amount), resource_classes: row.resource_classes,
    workload_digest: row.workload_digest, workload: row.workload, status: row.status,
    provider_id: row.provider_id, commitment_id: row.commitment_id, attempts: row.attempts,
    max_attempts: row.max_attempts, lease_expires_at: row.lease_expires_at?.toISOString?.() ?? row.lease_expires_at,
    result: row.result, execution_receipt: row.execution_receipt, failure: row.failure,
    created_at: row.created_at?.toISOString?.() ?? row.created_at,
    updated_at: row.updated_at?.toISOString?.() ?? row.updated_at
  };
}

export class InMemoryComputeJobStore {
  constructor({ now = () => new Date() } = {}) { this.now = now; this.providers = new Map(); this.commitments = new Map(); this.jobs = new Map(); this.operationEvents = []; }
  async registerProvider({ commitment, publicKeyPem, apiToken, recognisedCapacity }) {
    const existing = this.providers.get(commitment.provider_id);
    if (existing && existing.public_key !== publicKeyPem) throw new Error("provider key cannot be replaced");
    this.providers.set(commitment.provider_id, { provider_id: commitment.provider_id, public_key: publicKeyPem, token_digest: digest(apiToken), status: existing?.status ?? "active", suspension_reason: existing?.suspension_reason ?? null, suspended_at: existing?.suspended_at ?? null, resumed_at: existing?.resumed_at ?? null });
    if (this.commitments.has(commitment.commitment_id)) throw new Error("commitment already registered");
    this.commitments.set(commitment.commitment_id, { commitment: clone(commitment), recognised_capacity: recognisedCapacity, remaining_capacity: recognisedCapacity });
    return { provider_id: commitment.provider_id, commitment_id: commitment.commitment_id, recognised_capacity: recognisedCapacity };
  }
  async authenticate(providerId, apiToken) { return this.providers.get(providerId)?.token_digest === digest(apiToken); }
  async provider(providerId) { return clone(this.providers.get(providerId)); }
  async commitment(commitmentId) { return clone(this.commitments.get(commitmentId)); }
  async suspendProvider(providerId, reasonCode) { const provider=this.providers.get(providerId);if(!provider)throw new Error("provider not found");provider.status="suspended";provider.suspension_reason=reasonCode;provider.suspended_at=this.now().toISOString();const event={event_type:"provider_suspended",provider_id:providerId,reason_code:reasonCode,created_at:provider.suspended_at};this.operationEvents.push(event);return clone(event); }
  async resumeProvider(providerId) { const provider=this.providers.get(providerId);if(!provider)throw new Error("provider not found");provider.status="active";provider.suspension_reason=null;provider.resumed_at=this.now().toISOString();const event={event_type:"provider_resumed",provider_id:providerId,reason_code:null,created_at:provider.resumed_at};this.operationEvents.push(event);return clone(event); }
  async operations() { const statuses={queued:0,running:0,completed:0,refunded:0};for(const job of this.jobs.values())statuses[job.status]=(statuses[job.status]??0)+1;const now=this.now();return{providers:[...this.providers.values()].map(({token_digest:_token,...provider})=>clone(provider)),jobs:statuses,expired_leases:[...this.jobs.values()].filter(job=>job.status==="running"&&new Date(job.lease_expires_at)<=now).length,recent_events:this.operationEvents.slice(-50).reverse().map(clone)}; }
  async enqueue(input) {
    if ([...this.jobs.values()].some(job => job.redemption_id === input.redemption_id)) throw new Error("redemption already queued");
    const stamp = this.now().toISOString();
    const job = { job_id: input.job_id ?? `job:${randomUUID()}`, ...clone(input), status: "queued", provider_id: null, commitment_id: null, attempts: 0, max_attempts: input.max_attempts ?? 3, lease_expires_at: null, result: null, execution_receipt: null, failure: null, created_at: stamp, updated_at: stamp };
    this.jobs.set(job.job_id, job); return clone(job);
  }
  async job(jobId) { return clone(this.jobs.get(jobId)); }
  async claim(providerId, { leaseMs = 30_000 } = {}) {
    const now = this.now();
    if (this.providers.get(providerId)?.status !== "active") return null;
    const entry = [...this.commitments.values()].find(item => item.commitment.provider_id === providerId && new Date(item.commitment.available_from) <= now && new Date(item.commitment.available_until) > now && item.remaining_capacity > 0);
    if (!entry) return null;
    const job = [...this.jobs.values()].find(item => item.status === "queued" && item.resource_classes.includes(entry.commitment.resource_class) && item.amount <= entry.remaining_capacity);
    if (!job) return null;
    entry.remaining_capacity -= job.amount; job.status = "running"; job.provider_id = providerId; job.commitment_id = entry.commitment.commitment_id; job.attempts += 1; job.lease_expires_at = new Date(now.getTime() + leaseMs).toISOString(); job.updated_at = now.toISOString();
    return clone(job);
  }
  async complete(jobId, providerId, { result, receipt }) {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== "running" || job.provider_id !== providerId) throw new Error("job is not running for provider");
    job.status = "completed"; job.result = clone(result); job.execution_receipt = clone(receipt); job.lease_expires_at = null; job.updated_at = this.now().toISOString(); return clone(job);
  }
  async fail(jobId, providerId, { failure, retryable }) {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== "running" || job.provider_id !== providerId) throw new Error("job is not running for provider");
    const commitment = this.commitments.get(job.commitment_id); commitment.remaining_capacity += job.amount;
    const retry = retryable && job.attempts < job.max_attempts;
    job.status = retry ? "queued" : "refunded"; job.failure = clone(failure); job.provider_id = null; job.commitment_id = null; job.lease_expires_at = null; job.updated_at = this.now().toISOString();
    return { action: retry ? "requeued" : "refund", job: clone(job) };
  }
  async expiredRunning(now = this.now()) { return [...this.jobs.values()].filter(job => job.status === "running" && new Date(job.lease_expires_at) <= now).map(clone); }
}

export class PostgresComputeJobStore {
  constructor({ pool, now = () => new Date() } = {}) { if (!pool?.query) throw new Error("PostgreSQL pool is required"); this.pool = pool; this.now = now; this.atomicLedgerTransitions = true; }
  async registerProvider({ commitment, publicKeyPem, apiToken, recognisedCapacity }) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const provider = await client.query(`INSERT INTO protocol_compute_providers (provider_id, public_key, token_digest) VALUES ($1,$2,$3)
        ON CONFLICT (provider_id) DO UPDATE SET token_digest = EXCLUDED.token_digest WHERE protocol_compute_providers.public_key = EXCLUDED.public_key RETURNING provider_id`, [commitment.provider_id, publicKeyPem, digest(apiToken)]);
      if (!provider.rowCount) throw new Error("provider key cannot be replaced");
      await client.query(`INSERT INTO protocol_compute_commitments (commitment_id,provider_id,resource_class,recognised_capacity,remaining_capacity,available_from,available_until,commitment)
        VALUES ($1,$2,$3,$4,$4,$5,$6,$7::jsonb)`, [commitment.commitment_id, commitment.provider_id, commitment.resource_class, recognisedCapacity, commitment.available_from, commitment.available_until, JSON.stringify(commitment)]);
      await client.query("COMMIT");
      return { provider_id: commitment.provider_id, commitment_id: commitment.commitment_id, recognised_capacity: recognisedCapacity };
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
  async authenticate(providerId, apiToken) { const result = await this.pool.query("SELECT token_digest = $2 AS valid FROM protocol_compute_providers WHERE provider_id = $1", [providerId, digest(apiToken)]); return Boolean(result.rows[0]?.valid); }
  async provider(providerId) { const result = await this.pool.query("SELECT provider_id, public_key, status, suspension_reason, suspended_at, resumed_at FROM protocol_compute_providers WHERE provider_id = $1", [providerId]); return result.rowCount ? result.rows[0] : null; }
  async commitment(commitmentId) { const result = await this.pool.query("SELECT commitment, recognised_capacity, remaining_capacity FROM protocol_compute_commitments WHERE commitment_id = $1", [commitmentId]); return result.rowCount ? { commitment: result.rows[0].commitment, recognised_capacity: Number(result.rows[0].recognised_capacity), remaining_capacity: Number(result.rows[0].remaining_capacity) } : null; }
  async suspendProvider(providerId,reasonCode){const now=this.now();const result=await this.pool.query("UPDATE protocol_compute_providers SET status='suspended',suspension_reason=$1,suspended_at=$2 WHERE provider_id=$3 RETURNING provider_id",[reasonCode,now,providerId]);if(!result.rowCount)throw new Error("provider not found");const event={event_type:"provider_suspended",provider_id:providerId,reason_code:reasonCode,created_at:now.toISOString()};await this.pool.query("INSERT INTO protocol_compute_operations (event_type,provider_id,reason_code,event_data,created_at) VALUES ($1,$2,$3,$4::jsonb,$5)",[event.event_type,providerId,reasonCode,JSON.stringify(event),now]);return event;}
  async resumeProvider(providerId){const now=this.now();const result=await this.pool.query("UPDATE protocol_compute_providers SET status='active',suspension_reason=NULL,resumed_at=$1 WHERE provider_id=$2 RETURNING provider_id",[now,providerId]);if(!result.rowCount)throw new Error("provider not found");const event={event_type:"provider_resumed",provider_id:providerId,reason_code:null,created_at:now.toISOString()};await this.pool.query("INSERT INTO protocol_compute_operations (event_type,provider_id,event_data,created_at) VALUES ($1,$2,$3::jsonb,$4)",[event.event_type,providerId,JSON.stringify(event),now]);return event;}
  async operations(){const [providers,jobs,expired,events]=await Promise.all([this.pool.query("SELECT provider_id,status,suspension_reason,suspended_at,resumed_at,registered_at FROM protocol_compute_providers ORDER BY provider_id"),this.pool.query("SELECT status,count(*)::bigint AS count FROM protocol_compute_jobs GROUP BY status"),this.pool.query("SELECT count(*)::bigint AS count FROM protocol_compute_jobs WHERE status='running' AND lease_expires_at <= $1",[this.now()]),this.pool.query("SELECT event_type,provider_id,reason_code,event_data,created_at FROM protocol_compute_operations ORDER BY operation_number DESC LIMIT 50")]);const statuses={queued:0,running:0,completed:0,refunded:0};for(const row of jobs.rows)statuses[row.status]=Number(row.count);return{providers:providers.rows.map(row=>({...row,suspended_at:row.suspended_at?.toISOString?.()??row.suspended_at,resumed_at:row.resumed_at?.toISOString?.()??row.resumed_at,registered_at:row.registered_at?.toISOString?.()??row.registered_at})),jobs:statuses,expired_leases:Number(expired.rows[0].count),recent_events:events.rows.map(row=>({...row.event_data,created_at:row.created_at.toISOString()}))};}
  async enqueue(input) {
    const stamp = this.now(); const jobId = input.job_id ?? `job:${randomUUID()}`;
    const result = await this.pool.query(`INSERT INTO protocol_compute_jobs (job_id,redemption_id,holder_agent,series_id,amount,resource_classes,workload_digest,workload,status,max_attempts,created_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,'queued',$9,$10,$10) RETURNING *`, [jobId,input.redemption_id,input.holder_agent,input.series_id,input.amount,input.resource_classes,input.workload_digest,JSON.stringify(input.workload),input.max_attempts ?? 3,stamp]);
    return rowJob(result.rows[0]);
  }
  async job(jobId) { const result = await this.pool.query("SELECT * FROM protocol_compute_jobs WHERE job_id = $1", [jobId]); return rowJob(result.rows[0]); }
  async claim(providerId, { leaseMs = 30_000 } = {}) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN"); const now = this.now();
      const selected = await client.query(`SELECT j.*, c.commitment_id AS selected_commitment_id FROM protocol_compute_jobs j JOIN protocol_compute_commitments c
        ON c.provider_id=$1 AND c.resource_class=ANY(j.resource_classes) AND c.remaining_capacity>=j.amount
        JOIN protocol_compute_providers p ON p.provider_id=c.provider_id AND p.status='active'
        WHERE j.status='queued' AND c.available_from<=$2 AND c.available_until>$2 ORDER BY j.created_at,c.commitment_id FOR UPDATE OF j,c SKIP LOCKED LIMIT 1`, [providerId, now]);
      if (!selected.rowCount) { await client.query("COMMIT"); return null; }
      const row = selected.rows[0]; const lease = new Date(now.getTime() + leaseMs);
      await client.query("UPDATE protocol_compute_commitments SET remaining_capacity=remaining_capacity-$1 WHERE commitment_id=$2", [row.amount,row.selected_commitment_id]);
      const updated = await client.query(`UPDATE protocol_compute_jobs SET status='running',provider_id=$1,commitment_id=$2,attempts=attempts+1,lease_expires_at=$3,updated_at=$4 WHERE job_id=$5 RETURNING *`, [providerId,row.selected_commitment_id,lease,now,row.job_id]);
      await client.query("COMMIT"); return rowJob(updated.rows[0]);
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
  async complete(jobId, providerId, { result, receipt }) {
    const updated = await this.pool.query(`UPDATE protocol_compute_jobs SET status='completed',result=$1::jsonb,execution_receipt=$2::jsonb,lease_expires_at=NULL,updated_at=$3
      WHERE job_id=$4 AND status='running' AND provider_id=$5 RETURNING *`, [JSON.stringify(result),JSON.stringify(receipt),this.now(),jobId,providerId]);
    if (!updated.rowCount) throw new Error("job is not running for provider"); return rowJob(updated.rows[0]);
  }
  async completeAndRetire(jobId,providerId,{result,receipt}){
    const client=await this.pool.connect();
    try{
      await client.query("BEGIN");
      const selected=await client.query("SELECT * FROM protocol_compute_jobs WHERE job_id=$1 AND status='running' AND provider_id=$2 FOR UPDATE",[jobId,providerId]);
      if(!selected.rowCount)throw new Error("job is not running for provider");const job=selected.rows[0];
      const redemptionResult=await client.query("SELECT * FROM protocol_redemptions WHERE redemption_id=$1 FOR UPDATE",[job.redemption_id]);
      if(!redemptionResult.rowCount||redemptionResult.rows[0].status!=="locked")throw new Error("redemption is not locked");const redemption=redemptionResult.rows[0];
      await client.query("UPDATE protocol_accounts SET locked=locked-$1,balance=balance-$1 WHERE agent_id=$2 AND series_id=$3",[redemption.amount,redemption.holder_agent,redemption.series_id]);
      const retiredAt=this.now();const retirement={retirement_id:`retire:${job.redemption_id}`,redemption_id:job.redemption_id,series_id:redemption.series_id,amount:Number(redemption.amount),retired_at:retiredAt.toISOString(),status:"permanently_retired"};
      await client.query("UPDATE protocol_redemptions SET status='retired',retired_at=$1 WHERE redemption_id=$2",[retiredAt,job.redemption_id]);
      await client.query(`INSERT INTO protocol_retirements (retirement_id,redemption_id,series_id,amount,execution_receipt,record,retired_at) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)`,[retirement.retirement_id,job.redemption_id,redemption.series_id,redemption.amount,JSON.stringify(receipt),JSON.stringify(retirement),retiredAt]);
      await client.query(`UPDATE protocol_compute_jobs SET status='completed',result=$1::jsonb,execution_receipt=$2::jsonb,lease_expires_at=NULL,updated_at=$3 WHERE job_id=$4`,[JSON.stringify(result),JSON.stringify(receipt),retiredAt,jobId]);
      await client.query("INSERT INTO protocol_audit_events (event_type,event_data) VALUES ('retirement',$1::jsonb)",[JSON.stringify(retirement)]);
      await client.query("COMMIT");return{job:rowJob({...job,status:"completed",result,execution_receipt:receipt,lease_expires_at:null,updated_at:retiredAt}),retirement};
    }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
  }
  async fail(jobId, providerId, { failure, retryable }) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const selected = await client.query("SELECT * FROM protocol_compute_jobs WHERE job_id=$1 AND status='running' AND provider_id=$2 FOR UPDATE", [jobId,providerId]);
      if (!selected.rowCount) throw new Error("job is not running for provider"); const job=selected.rows[0];
      await client.query("UPDATE protocol_compute_commitments SET remaining_capacity=remaining_capacity+$1 WHERE commitment_id=$2", [job.amount,job.commitment_id]);
      const retry=retryable && job.attempts<job.max_attempts; const status=retry?"queued":"refunded";
      if(!retry){const redemption=await client.query("SELECT * FROM protocol_redemptions WHERE redemption_id=$1 FOR UPDATE",[job.redemption_id]);if(!redemption.rowCount||redemption.rows[0].status!=="locked")throw new Error("redemption is not locked");const red=redemption.rows[0];await client.query("UPDATE protocol_accounts SET locked=locked-$1 WHERE agent_id=$2 AND series_id=$3",[red.amount,red.holder_agent,red.series_id]);await client.query("UPDATE protocol_redemptions SET status='refunded',failure=$1::jsonb WHERE redemption_id=$2",[JSON.stringify(failure),job.redemption_id]);await client.query("INSERT INTO protocol_audit_events (event_type,event_data) VALUES ('redemption_refunded',$1::jsonb)",[JSON.stringify({redemption_id:job.redemption_id,series_id:red.series_id,amount:Number(red.amount),status:"refunded",failure})]);}
      const updated=await client.query(`UPDATE protocol_compute_jobs SET status=$1,failure=$2::jsonb,provider_id=NULL,commitment_id=NULL,lease_expires_at=NULL,updated_at=$3 WHERE job_id=$4 RETURNING *`, [status,JSON.stringify(failure),this.now(),jobId]);
      await client.query("COMMIT"); return { action:retry?"requeued":"refund",job:rowJob(updated.rows[0]) };
    } catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
  }
  async expiredRunning(now=this.now()){const result=await this.pool.query("SELECT * FROM protocol_compute_jobs WHERE status='running' AND lease_expires_at <= $1 ORDER BY lease_expires_at",[now]);return result.rows.map(rowJob);}
}
