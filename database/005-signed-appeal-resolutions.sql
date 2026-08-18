BEGIN;
CREATE TABLE IF NOT EXISTS protocol_appeal_resolutions (
  resolution_id text PRIMARY KEY,
  appeal_id text NOT NULL UNIQUE REFERENCES protocol_validation_appeals(appeal_id),
  outcome text NOT NULL CHECK (outcome IN ('upheld', 'overturned')),
  rationale_code text NOT NULL CHECK (rationale_code IN ('validator_correct', 'validator_error', 'insufficient_evidence', 'profile_gap')),
  record jsonb NOT NULL,
  reviewer_id text NOT NULL,
  resolved_at timestamptz NOT NULL
);
COMMIT;
