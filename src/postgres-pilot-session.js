// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.
import { createHash, randomBytes, randomUUID } from "node:crypto";

const tokenDigest = token => createHash("sha256").update(token).digest("base64url");

export class PostgresPilotSessionStore {
  constructor({ pool, now = () => new Date(), ttlMs = 3_600_000, windowMs = 60_000, maxTurnsPerWindow = 20 } = {}) {
    if (!pool) throw new Error("PostgreSQL pool is required");
    for (const [name, value] of Object.entries({ ttlMs, windowMs, maxTurnsPerWindow })) {
      if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be positive`);
    }
    Object.assign(this, { pool, now, ttlMs, windowMs, maxTurnsPerWindow });
  }

  async issue({ consent, noticeVersion, clientId } = {}) {
    if (consent !== true || typeof noticeVersion !== "string" || !noticeVersion.trim()) {
      throw Object.assign(new Error("explicit consent and notice_version are required"), { status: 400 });
    }
    const token = randomBytes(32).toString("base64url");
    const issuedAt = this.now();
    const sessionId = `session:${randomUUID()}`;
    const expiresAt = new Date(issuedAt.getTime() + this.ttlMs);
    await this.pool.query(
      `INSERT INTO protocol_pilot_sessions
        (session_id, token_digest, client_id, notice_version, consent_status, issued_at, expires_at)
       VALUES ($1,$2,$3,$4,'active',$5,$6)`,
      [sessionId, tokenDigest(token), clientId ?? null, noticeVersion.trim(), issuedAt, expiresAt]
    );
    return { token, session_id: sessionId, expires_at: expiresAt.toISOString(), notice_version: noticeVersion.trim() };
  }

  async authorise(token) {
    if (typeof token !== "string") throw Object.assign(new Error("valid session authorisation required"), { status: 401 });
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query("SELECT * FROM protocol_pilot_sessions WHERE token_digest = $1 FOR UPDATE", [tokenDigest(token)]);
      const session = result.rows[0];
      const current = this.now();
      if (!session || session.consent_status !== "active") throw Object.assign(new Error("valid session authorisation required"), { status: 401 });
      if (new Date(session.expires_at) <= current) throw Object.assign(new Error("session has expired"), { status: 401 });
      const previousWindow = session.rate_window_started_at && new Date(session.rate_window_started_at);
      const inWindow = previousWindow && current.getTime() - previousWindow.getTime() < this.windowMs;
      const count = inWindow ? session.rate_turn_count : 0;
      if (count >= this.maxTurnsPerWindow) throw Object.assign(new Error("session rate limit exceeded"), { status: 429 });
      await client.query(
        "UPDATE protocol_pilot_sessions SET rate_window_started_at = $2, rate_turn_count = $3 WHERE session_id = $1",
        [session.session_id, inWindow ? previousWindow : current, count + 1]
      );
      await client.query("COMMIT");
      return { sessionId: session.session_id, noticeVersion: session.notice_version };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }

  async withdraw(token) {
    if (typeof token !== "string") throw Object.assign(new Error("valid session authorisation required"), { status: 401 });
    const result = await this.pool.query(
      `UPDATE protocol_pilot_sessions SET consent_status = 'withdrawn', withdrawn_at = $2
       WHERE token_digest = $1 AND consent_status = 'active' RETURNING session_id`,
      [tokenDigest(token), this.now()]
    );
    if (!result.rowCount) throw Object.assign(new Error("valid active session required"), { status: 401 });
    return { session_id: result.rows[0].session_id, status: "consent_withdrawn" };
  }

  async purgeExpired(before = this.now()) {
    const cutoff = before instanceof Date ? before : new Date(before);
    if (Number.isNaN(cutoff.getTime()) || cutoff > this.now()) throw Object.assign(new Error("retention cutoff must be a valid past date"), { status: 400 });
    const result = await this.pool.query(
      `DELETE FROM protocol_pilot_sessions
       WHERE expires_at <= $1 OR (consent_status = 'withdrawn' AND withdrawn_at <= $1)`, [cutoff]
    );
    return { deleted_sessions: result.rowCount, cutoff: cutoff.toISOString() };
  }
}
