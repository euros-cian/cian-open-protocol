// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.
import { createHash, randomBytes, randomUUID } from "node:crypto";

function tokenDigest(token) {
  return createHash("sha256").update(token).digest("base64url");
}

export class PilotSessionManager {
  constructor({ now = () => new Date(), ttlMs = 3_600_000, windowMs = 60_000, maxTurnsPerWindow = 20 } = {}) {
    if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) throw new Error("ttlMs must be positive");
    if (!Number.isSafeInteger(windowMs) || windowMs <= 0) throw new Error("windowMs must be positive");
    if (!Number.isSafeInteger(maxTurnsPerWindow) || maxTurnsPerWindow <= 0) throw new Error("maxTurnsPerWindow must be positive");
    this.now = now;
    this.ttlMs = ttlMs;
    this.windowMs = windowMs;
    this.maxTurnsPerWindow = maxTurnsPerWindow;
    this.sessions = new Map();
  }

  issue({ consent, noticeVersion, clientId } = {}) {
    if (consent !== true || typeof noticeVersion !== "string" || !noticeVersion.trim()) {
      throw Object.assign(new Error("explicit consent and notice_version are required"), { status: 400 });
    }
    const token = randomBytes(32).toString("base64url");
    const issuedAt = this.now();
    const session = {
      sessionId: `session:${randomUUID()}`, clientId: clientId ?? null,
      noticeVersion: noticeVersion.trim(), issuedAt: issuedAt.toISOString(),
      expiresAt: new Date(issuedAt.getTime() + this.ttlMs).toISOString(), turns: []
    };
    this.sessions.set(tokenDigest(token), session);
    return { token, session_id: session.sessionId, expires_at: session.expiresAt, notice_version: session.noticeVersion };
  }

  authorise(token) {
    const session = typeof token === "string" ? this.sessions.get(tokenDigest(token)) : null;
    if (!session) throw Object.assign(new Error("valid session authorisation required"), { status: 401 });
    const current = this.now().getTime();
    if (Date.parse(session.expiresAt) <= current) {
      throw Object.assign(new Error("session has expired"), { status: 401 });
    }
    session.turns = session.turns.filter(item => current - item < this.windowMs);
    if (session.turns.length >= this.maxTurnsPerWindow) {
      throw Object.assign(new Error("session rate limit exceeded"), { status: 429 });
    }
    session.turns.push(current);
    return { sessionId: session.sessionId, noticeVersion: session.noticeVersion };
  }

  withdraw(token) {
    const digest = typeof token === "string" ? tokenDigest(token) : null;
    const session = digest ? this.sessions.get(digest) : null;
    if (!session) throw Object.assign(new Error("valid active session required"), { status: 401 });
    this.sessions.delete(digest);
    return { session_id: session.sessionId, status: "consent_withdrawn" };
  }

  purgeExpired(before = this.now()) {
    const cutoff = before instanceof Date ? before : new Date(before);
    if (Number.isNaN(cutoff.getTime()) || cutoff > this.now()) throw Object.assign(new Error("retention cutoff must be a valid past date"), { status: 400 });
    let deleted = 0;
    for (const [digest, session] of this.sessions) {
      if (Date.parse(session.expiresAt) <= cutoff.getTime()) {
        this.sessions.delete(digest);
        deleted += 1;
      }
    }
    return { deleted_sessions: deleted, cutoff: cutoff.toISOString() };
  }
}
