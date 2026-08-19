BEGIN;

ALTER TABLE protocol_compute_providers
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'suspended'));
ALTER TABLE protocol_compute_providers ADD COLUMN IF NOT EXISTS suspension_reason text;
ALTER TABLE protocol_compute_providers ADD COLUMN IF NOT EXISTS suspended_at timestamptz;
ALTER TABLE protocol_compute_providers ADD COLUMN IF NOT EXISTS resumed_at timestamptz;

CREATE TABLE IF NOT EXISTS protocol_compute_operations (
  operation_number bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type text NOT NULL,
  provider_id text REFERENCES protocol_compute_providers(provider_id),
  reason_code text,
  event_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS protocol_compute_operations_provider_idx
  ON protocol_compute_operations (provider_id, created_at DESC);

COMMIT;
