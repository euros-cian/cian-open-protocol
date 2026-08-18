BEGIN;
CREATE TABLE IF NOT EXISTS protocol_validation_appeals (
  appeal_id text PRIMARY KEY,
  session_id text REFERENCES protocol_pilot_sessions(session_id) ON DELETE SET NULL,
  interaction_id text NOT NULL,
  proof_id text,
  language_profile text NOT NULL,
  disputed_decision text NOT NULL CHECK (disputed_decision IN ('QUALIFIES', 'DOES_NOT_QUALIFY')),
  reason_code text NOT NULL CHECK (reason_code IN ('false_positive', 'false_negative', 'mixed_language', 'learner_language', 'dialect', 'other')),
  status text NOT NULL CHECK (status IN ('open', 'under_review', 'upheld', 'overturned', 'closed')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS protocol_validation_appeals_status
  ON protocol_validation_appeals (status, submitted_at);
COMMIT;
