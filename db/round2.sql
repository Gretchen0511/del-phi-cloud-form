CREATE TABLE IF NOT EXISTS delphi_round2_responses (
 id UUID PRIMARY KEY,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 expert_id TEXT NOT NULL,
 questionnaire_version TEXT NOT NULL,
 payload JSONB NOT NULL
);
