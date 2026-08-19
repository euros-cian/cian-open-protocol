CREATE TABLE IF NOT EXISTS protocol_sandbox_grants (
  agent_id TEXT PRIMARY KEY REFERENCES protocol_agents(agent_id),
  proof_id TEXT NOT NULL UNIQUE,
  series_id TEXT NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS protocol_sandbox_state (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO protocol_sandbox_state (singleton, enabled)
VALUES (TRUE, TRUE)
ON CONFLICT (singleton) DO NOTHING;
