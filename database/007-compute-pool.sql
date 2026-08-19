BEGIN;

ALTER TABLE protocol_redemptions
  DROP CONSTRAINT IF EXISTS protocol_redemptions_status_check;
ALTER TABLE protocol_redemptions
  ADD CONSTRAINT protocol_redemptions_status_check CHECK (status IN ('locked', 'retired', 'refunded'));
ALTER TABLE protocol_redemptions ADD COLUMN IF NOT EXISTS failure jsonb;

CREATE TABLE IF NOT EXISTS protocol_compute_providers (
  provider_id text PRIMARY KEY,
  public_key text NOT NULL,
  token_digest text NOT NULL,
  registered_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS protocol_compute_commitments (
  commitment_id text PRIMARY KEY,
  provider_id text NOT NULL REFERENCES protocol_compute_providers(provider_id),
  resource_class text NOT NULL,
  recognised_capacity bigint NOT NULL CHECK (recognised_capacity > 0),
  remaining_capacity bigint NOT NULL CHECK (remaining_capacity >= 0 AND remaining_capacity <= recognised_capacity),
  available_from timestamptz NOT NULL,
  available_until timestamptz NOT NULL CHECK (available_until > available_from),
  commitment jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS protocol_compute_commitments_available_idx
  ON protocol_compute_commitments (resource_class, available_from, available_until);

CREATE TABLE IF NOT EXISTS protocol_compute_jobs (
  job_id text PRIMARY KEY,
  redemption_id text NOT NULL UNIQUE REFERENCES protocol_redemptions(redemption_id),
  holder_agent text NOT NULL REFERENCES protocol_agents(agent_id),
  series_id text NOT NULL,
  amount bigint NOT NULL CHECK (amount > 0),
  resource_classes text[] NOT NULL,
  workload_digest text NOT NULL,
  workload jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'refunded')),
  provider_id text REFERENCES protocol_compute_providers(provider_id),
  commitment_id text REFERENCES protocol_compute_commitments(commitment_id),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL CHECK (max_attempts > 0),
  lease_expires_at timestamptz,
  result jsonb,
  execution_receipt jsonb,
  failure jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS protocol_compute_jobs_queue_idx
  ON protocol_compute_jobs (status, created_at);

COMMIT;
