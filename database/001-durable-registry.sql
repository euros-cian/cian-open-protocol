BEGIN;

CREATE TABLE IF NOT EXISTS protocol_agents (
  agent_id text PRIMARY KEY,
  public_key text NOT NULL,
  manifest jsonb NOT NULL,
  assurance_level text NOT NULL,
  registered_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS protocol_accounts (
  agent_id text NOT NULL REFERENCES protocol_agents(agent_id),
  series_id text NOT NULL,
  balance bigint NOT NULL DEFAULT 0 CHECK (balance >= 0),
  locked bigint NOT NULL DEFAULT 0 CHECK (locked >= 0 AND locked <= balance),
  sequence bigint NOT NULL DEFAULT 0 CHECK (sequence >= 0),
  PRIMARY KEY (agent_id, series_id)
);

CREATE TABLE IF NOT EXISTS protocol_consumed_proofs (
  proof_id text PRIMARY KEY,
  series_id text NOT NULL,
  recipient_agent_id text NOT NULL REFERENCES protocol_agents(agent_id),
  amount bigint NOT NULL CHECK (amount >= 0),
  consumed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS protocol_consumed_requests (
  request_id text PRIMARY KEY,
  nonce text NOT NULL UNIQUE,
  request_type text NOT NULL,
  consumed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS protocol_transfers (
  transfer_id text PRIMARY KEY REFERENCES protocol_consumed_requests(request_id),
  series_id text NOT NULL,
  from_agent text NOT NULL REFERENCES protocol_agents(agent_id),
  to_agent text NOT NULL REFERENCES protocol_agents(agent_id),
  amount bigint NOT NULL CHECK (amount > 0),
  accepted_sender_sequence bigint NOT NULL,
  next_sender_sequence bigint NOT NULL,
  receipt jsonb NOT NULL,
  committed_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS protocol_redemptions (
  redemption_id text PRIMARY KEY REFERENCES protocol_consumed_requests(request_id),
  holder_agent text NOT NULL REFERENCES protocol_agents(agent_id),
  series_id text NOT NULL,
  amount bigint NOT NULL CHECK (amount > 0),
  request jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('locked', 'retired')),
  locked_at timestamptz NOT NULL,
  retired_at timestamptz
);

CREATE TABLE IF NOT EXISTS protocol_retirements (
  retirement_id text PRIMARY KEY,
  redemption_id text NOT NULL UNIQUE REFERENCES protocol_redemptions(redemption_id),
  series_id text NOT NULL,
  amount bigint NOT NULL CHECK (amount > 0),
  execution_receipt jsonb NOT NULL,
  record jsonb NOT NULL,
  retired_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS protocol_audit_events (
  event_number bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type text NOT NULL,
  event_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
