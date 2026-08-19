// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.
export class InMemorySandboxStore {
  constructor() { this.grants = new Map(); this.enabled = true; }
  async claimGrant(grant) {
    if (this.grants.has(grant.agent_id)) return false;
    this.grants.set(grant.agent_id, structuredClone(grant));
    return true;
  }
  async releaseGrant(agentId) { this.grants.delete(agentId); }
  async isEnabled() { return this.enabled; }
  async setEnabled(enabled) { this.enabled = Boolean(enabled); return this.enabled; }
}

export class PostgresSandboxStore {
  constructor({ pool } = {}) { if (!pool?.query) throw new Error("PostgreSQL pool is required"); this.pool = pool; }
  async claimGrant({ agent_id, proof_id, series_id, amount }) {
    const result = await this.pool.query(
      `INSERT INTO protocol_sandbox_grants (agent_id,proof_id,series_id,amount)
       VALUES ($1,$2,$3,$4) ON CONFLICT (agent_id) DO NOTHING RETURNING agent_id`,
      [agent_id, proof_id, series_id, amount]
    );
    return result.rowCount === 1;
  }
  async releaseGrant(agentId) { await this.pool.query("DELETE FROM protocol_sandbox_grants WHERE agent_id=$1", [agentId]); }
  async isEnabled() {
    const result = await this.pool.query("SELECT enabled FROM protocol_sandbox_state WHERE singleton=TRUE");
    return Boolean(result.rows[0]?.enabled);
  }
  async setEnabled(enabled) {
    await this.pool.query("UPDATE protocol_sandbox_state SET enabled=$1,changed_at=now() WHERE singleton=TRUE", [Boolean(enabled)]);
    return Boolean(enabled);
  }
}
