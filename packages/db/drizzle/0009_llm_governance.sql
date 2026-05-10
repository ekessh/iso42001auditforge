-- SPDX-License-Identifier: BUSL-1.1
-- 0009_llm_governance.sql
--
-- LLM governance tables (Wave 2):
--   * llm_invocations  — full per-call ledger
--   * consent_records  — engagement-level cloud consent grants
--   * claim_schema_registry — per-engagement entity / relation type allowlist
--   * llm_budget_events — warnings / exceeded events for the cost ledger
--
-- All tables enforce per-firm RLS using the existing app.current_firm
-- session GUC, mirroring the pattern in 0002_rls_business_tables.sql.

BEGIN;

-- =========================================================================
-- llm_invocations
-- =========================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'llm_invocation_decision') THEN
    CREATE TYPE llm_invocation_decision AS ENUM ('accepted', 'rejected');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'llm_invocation_tier') THEN
    CREATE TYPE llm_invocation_tier AS ENUM ('small', 'medium', 'large', 'reasoning');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS llm_invocations (
    id                       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id                  uuid NOT NULL,
    engagement_id            uuid NOT NULL,
    task                     text NOT NULL,
    tier                     llm_invocation_tier NOT NULL,
    provider                 text NOT NULL,
    model_name               text NOT NULL,
    model_hash               text,
    model_version            text,
    temperature              real,
    prompt_template_id       text,
    prompt_template_version  text NOT NULL,
    prompt_template_hash     text,
    input_tokens             integer NOT NULL DEFAULT 0,
    output_tokens            integer NOT NULL DEFAULT 0,
    latency_ms               integer NOT NULL DEFAULT 0,
    cost_usd                 real,
    reasoning_trace          text,
    decision                 llm_invocation_decision,
    decision_by_auditor_id   uuid,
    decided_at               timestamptz,
    metadata                 jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at               timestamptz NOT NULL DEFAULT now()
);

-- Earlier migration (0002) created llm_invocations without the governance
-- columns this migration relies on. Bring the existing table up to spec.
ALTER TABLE llm_invocations ADD COLUMN IF NOT EXISTS task text;
ALTER TABLE llm_invocations ADD COLUMN IF NOT EXISTS tier llm_invocation_tier;
ALTER TABLE llm_invocations ADD COLUMN IF NOT EXISTS model_version text;
ALTER TABLE llm_invocations ADD COLUMN IF NOT EXISTS prompt_template_version text;
ALTER TABLE llm_invocations ADD COLUMN IF NOT EXISTS prompt_template_hash text;
ALTER TABLE llm_invocations ADD COLUMN IF NOT EXISTS input_tokens integer NOT NULL DEFAULT 0;
ALTER TABLE llm_invocations ADD COLUMN IF NOT EXISTS output_tokens integer NOT NULL DEFAULT 0;
ALTER TABLE llm_invocations ADD COLUMN IF NOT EXISTS decision_by_auditor_id uuid;
ALTER TABLE llm_invocations ADD COLUMN IF NOT EXISTS decided_at timestamptz;
ALTER TABLE llm_invocations ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS llm_invocations_engagement_ix
    ON llm_invocations (engagement_id);
CREATE INDEX IF NOT EXISTS llm_invocations_task_ix
    ON llm_invocations (engagement_id, task);
CREATE INDEX IF NOT EXISTS llm_invocations_created_ix
    ON llm_invocations (engagement_id, created_at);
CREATE INDEX IF NOT EXISTS llm_invocations_provider_ix
    ON llm_invocations (provider, model_name);

ALTER TABLE llm_invocations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='llm_invocations'
      AND policyname='llm_invocations_firm_rls'
  ) THEN
    CREATE POLICY llm_invocations_firm_rls ON llm_invocations
      USING (firm_id = current_setting('app.current_firm', true)::uuid);
  END IF;
END $$;

-- =========================================================================
-- consent_records — engagement-level cloud consent
-- =========================================================================

CREATE TABLE IF NOT EXISTS consent_records (
    id                       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id                  uuid NOT NULL,
    engagement_id            uuid NOT NULL,
    granted_by               uuid NOT NULL,
    granted_at               timestamptz NOT NULL DEFAULT now(),
    revoked_at               timestamptz,
    expires_at               timestamptz,
    providers                text[] NOT NULL,
    purpose                  text NOT NULL,
    scope                    jsonb NOT NULL DEFAULT '{}'::jsonb,
    written_consent_doc_id   text,
    created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS consent_records_engagement_ix
    ON consent_records (engagement_id);
CREATE INDEX IF NOT EXISTS consent_records_active_ix
    ON consent_records (engagement_id) WHERE revoked_at IS NULL;

ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='consent_records'
      AND policyname='consent_records_firm_rls'
  ) THEN
    CREATE POLICY consent_records_firm_rls ON consent_records
      USING (firm_id = current_setting('app.current_firm', true)::uuid);
  END IF;
END $$;

-- =========================================================================
-- claim_schema_registry — per-engagement entity / relation type allowlist
-- =========================================================================

CREATE TABLE IF NOT EXISTS claim_schema_registry (
    id                       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id                  uuid NOT NULL,
    engagement_id            uuid NOT NULL,
    version                  integer NOT NULL,
    entity_types             jsonb NOT NULL DEFAULT '[]'::jsonb,
    relation_types           jsonb NOT NULL DEFAULT '[]'::jsonb,
    status                   text NOT NULL DEFAULT 'draft',
    parent_version_id        uuid,
    frozen_at                timestamptz,
    created_at               timestamptz NOT NULL DEFAULT now(),
    UNIQUE (engagement_id, version)
);

CREATE INDEX IF NOT EXISTS claim_schema_registry_engagement_ix
    ON claim_schema_registry (engagement_id);

ALTER TABLE claim_schema_registry ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='claim_schema_registry'
      AND policyname='claim_schema_registry_firm_rls'
  ) THEN
    CREATE POLICY claim_schema_registry_firm_rls ON claim_schema_registry
      USING (firm_id = current_setting('app.current_firm', true)::uuid);
  END IF;
END $$;

-- =========================================================================
-- llm_budget_events — warning / exceeded ledger
-- =========================================================================

CREATE TABLE IF NOT EXISTS llm_budget_events (
    id                       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id                  uuid NOT NULL,
    engagement_id            uuid NOT NULL,
    event                    text NOT NULL,
    cap_usd                  real,
    spent_usd                real NOT NULL,
    projected_usd            real NOT NULL,
    utilization              real NOT NULL,
    raised_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS llm_budget_events_engagement_ix
    ON llm_budget_events (engagement_id, raised_at);

ALTER TABLE llm_budget_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='llm_budget_events'
      AND policyname='llm_budget_events_firm_rls'
  ) THEN
    CREATE POLICY llm_budget_events_firm_rls ON llm_budget_events
      USING (firm_id = current_setting('app.current_firm', true)::uuid);
  END IF;
END $$;

COMMIT;
