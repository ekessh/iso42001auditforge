-- SPDX-License-Identifier: BUSL-1.1
-- 0014_cross_engagement_memory.sql
--
-- Phase 15: per-firm anonymized cross-engagement pattern memory.
--
-- CLAUDE.md hard rule: anonymized — no auditee identifiers, no finding-specific
-- text. The application layer (`@auditforge/cross-engagement-memory`) enforces
-- the deny-list at extraction time. RLS pins every read to the caller's firm.

BEGIN;

CREATE TABLE IF NOT EXISTS cross_engagement_patterns (
    id              text PRIMARY KEY,
    firm_id         uuid NOT NULL,
    pattern_kind    text NOT NULL,
    dimensions      jsonb NOT NULL DEFAULT '{}'::jsonb,
    sample_size     integer NOT NULL DEFAULT 0,
    observation     text NOT NULL,
    confidence      real NOT NULL DEFAULT 0,
    last_updated    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT cross_engagement_patterns_kind_chk
        CHECK (pattern_kind IN ('clause_evidence_failure_rate', 'probe_failure_rate')),
    CONSTRAINT cross_engagement_patterns_observation_len_chk
        CHECK (char_length(observation) <= 500),
    CONSTRAINT cross_engagement_patterns_confidence_chk
        CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE INDEX IF NOT EXISTS cross_engagement_patterns_firm_kind_ix
    ON cross_engagement_patterns (firm_id, pattern_kind, last_updated DESC);
CREATE INDEX IF NOT EXISTS cross_engagement_patterns_dimensions_gin
    ON cross_engagement_patterns USING GIN (dimensions);

ALTER TABLE cross_engagement_patterns ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='cross_engagement_patterns'
      AND policyname='cross_engagement_patterns_firm_rls'
  ) THEN
    CREATE POLICY cross_engagement_patterns_firm_rls ON cross_engagement_patterns
      USING (firm_id = current_setting('app.current_firm', true)::uuid);
  END IF;
END $$;

COMMIT;
