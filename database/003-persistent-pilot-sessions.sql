BEGIN;
CREATE TABLE IF NOT EXISTS protocol_pilot_sessions (
  session_id text PRIMARY KEY,
  token_digest text NOT NULL UNIQUE,
  client_id text,
  notice_version text NOT NULL,
  consent_status text NOT NULL CHECK (consent_status IN ('active', 'withdrawn')),
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  rate_window_started_at timestamptz,
  rate_turn_count integer NOT NULL DEFAULT 0 CHECK (rate_turn_count >= 0),
  withdrawn_at timestamptz,
  CHECK (expires_at > issued_at)
);
CREATE INDEX IF NOT EXISTS protocol_pilot_sessions_retention
  ON protocol_pilot_sessions (expires_at, consent_status);
COMMIT;
