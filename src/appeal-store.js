// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.
import { randomUUID } from "node:crypto";
import { createAppealResolution } from "./appeal-review.js";

const REASONS = new Set(["false_positive", "false_negative", "mixed_language", "learner_language", "dialect", "other"]);
const DECISIONS = new Set(["QUALIFIES", "DOES_NOT_QUALIFY", "REVIEW_REQUIRED"]);

function appealRecord({ sessionId, input, now }) {
  if (!input?.interaction_id || !DECISIONS.has(input.disputed_decision) || !REASONS.has(input.reason_code)) {
    throw Object.assign(new Error("interaction_id, disputed_decision and valid reason_code are required"), { status: 400 });
  }
  return {
    appeal_id: `appeal:${randomUUID()}`, session_id: sessionId,
    interaction_id: input.interaction_id, proof_id: input.proof_id ?? null,
    language_profile: input.language_profile ?? "cy-v0.1",
    disputed_decision: input.disputed_decision, reason_code: input.reason_code,
    status: "open", submitted_at: now().toISOString(), resolved_at: null
  };
}

export class InMemoryAppealStore {
  constructor({ now = () => new Date() } = {}) { this.now = now; this.appeals = new Map(); }
  async create({ sessionId, input }) {
    const record = appealRecord({ sessionId, input, now: this.now });
    this.appeals.set(record.appeal_id, record);
    return structuredClone(record);
  }
  async get({ appealId, sessionId }) {
    const record = this.appeals.get(appealId);
    return record?.session_id === sessionId ? structuredClone(record) : null;
  }
  async resolve({ appealId, outcome, rationaleCode, signer, now = this.now }) {
    const appeal = this.appeals.get(appealId);
    const resolution = createAppealResolution({ appeal, outcome, rationaleCode, signer, now });
    appeal.status = outcome;
    appeal.resolved_at = resolution.resolved_at;
    appeal.resolution = resolution;
    return structuredClone(resolution);
  }
}

export class PostgresAppealStore {
  constructor({ pool, now = () => new Date() } = {}) { if (!pool) throw new Error("PostgreSQL pool is required"); this.pool = pool; this.now = now; }
  async create({ sessionId, input }) {
    const record = appealRecord({ sessionId, input, now: this.now });
    await this.pool.query(
      `INSERT INTO protocol_validation_appeals
       (appeal_id, session_id, interaction_id, proof_id, language_profile, disputed_decision, reason_code, status, submitted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [record.appeal_id, record.session_id, record.interaction_id, record.proof_id, record.language_profile,
       record.disputed_decision, record.reason_code, record.status, record.submitted_at]
    );
    return record;
  }
  async get({ appealId, sessionId }) {
    const result = await this.pool.query(
      `SELECT a.*, r.record AS resolution FROM protocol_validation_appeals a
       LEFT JOIN protocol_appeal_resolutions r ON r.appeal_id = a.appeal_id
       WHERE a.appeal_id = $1 AND a.session_id = $2`, [appealId, sessionId]
    );
    return result.rows[0] ?? null;
  }
  async resolve({ appealId, outcome, rationaleCode, signer, now = this.now }) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query("SELECT * FROM protocol_validation_appeals WHERE appeal_id = $1 FOR UPDATE", [appealId]);
      const appeal = result.rows[0];
      const resolution = createAppealResolution({ appeal, outcome, rationaleCode, signer, now });
      await client.query(
        `INSERT INTO protocol_appeal_resolutions
         (resolution_id, appeal_id, outcome, rationale_code, record, reviewer_id, resolved_at)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)`,
        [resolution.resolution_id, appealId, outcome, rationaleCode, JSON.stringify(resolution), resolution.reviewer_id, resolution.resolved_at]
      );
      await client.query("UPDATE protocol_validation_appeals SET status = $2, resolved_at = $3 WHERE appeal_id = $1", [appealId, outcome, resolution.resolved_at]);
      await client.query("COMMIT");
      return resolution;
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
}
