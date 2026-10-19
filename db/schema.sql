CREATE TABLE IF NOT EXISTS delphi_responses (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expert_name TEXT,
  expert_org TEXT,
  payload JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS delphi_round2_responses (
 id UUID PRIMARY KEY,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 expert_id TEXT NOT NULL,
 questionnaire_version TEXT NOT NULL,
 payload JSONB NOT NULL
);
