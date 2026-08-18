BEGIN;

CREATE TABLE IF NOT EXISTS protocol_attestations (
  attestation_id text PRIMARY KEY,
  interaction_id text NOT NULL,
  attestation_type text NOT NULL CHECK (attestation_type IN ('origin', 'validation')),
  record jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS protocol_language_proofs (
  proof_id text PRIMARY KEY,
  interaction_id text NOT NULL,
  recipient_agent_id text NOT NULL REFERENCES protocol_agents(agent_id),
  language_profile text NOT NULL,
  weight integer NOT NULL CHECK (weight > 0),
  record jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('unconsumed', 'consumed')),
  epoch_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS protocol_language_proofs_one_interaction
  ON protocol_language_proofs (interaction_id, recipient_agent_id, language_profile);

CREATE TABLE IF NOT EXISTS protocol_epochs (
  epoch_id text PRIMARY KEY,
  series_id text NOT NULL UNIQUE,
  language_profile text NOT NULL,
  budget bigint NOT NULL CHECK (budget >= 0),
  allocated_total bigint NOT NULL CHECK (allocated_total >= 0 AND allocated_total <= budget),
  record jsonb NOT NULL,
  closed_at timestamptz NOT NULL
);

COMMIT;
