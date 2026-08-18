// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.
import { randomUUID } from "node:crypto";

const REASONS = new Set(["false_positive", "false_negative", "mixed_language", "learner_language", "dialect", "other"]);
const DECISIONS = new Set(["QUALIFIES", "DOES_NOT_QUALIFY"]);

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
      "SELECT * FROM protocol_validation_appeals WHERE appeal_id = $1 AND session_id = $2", [appealId, sessionId]
    );
    return result.rows[0] ?? null;
  }
}
