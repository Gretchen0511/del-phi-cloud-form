CREATE TABLE IF NOT EXISTS delphi_responses (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expert_name TEXT,
  expert_org TEXT,
  payload JSONB NOT NULL
);
