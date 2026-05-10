-- SPDX-License-Identifier: BUSL-1.1
-- 0010_observability_and_surveillance_plan.sql
--
-- Phase 11 surveillance + observability tables:
--   * surveillance_plans          - per-client surveillance programme (ISO 17021-1 § 9.6)
--   * surveillance_visits         - schedule entries (Stage 1, Stage 2, Surv 1/2, Recert)
--   * surveillance_flags          - anomaly detector outputs routed to ledger
--   * web_vitals_samples          - browser RUM web-vitals samples
--   * observability_errors        - browser-side error reports
--
-- All tables enforce per-firm RLS using `app.current_firm`, mirroring 0002.

BEGIN;

-- =========================================================================
-- surveillance_plans
-- =========================================================================

CREATE TABLE IF NOT EXISTS surveillance_plans (
    id                            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id                       uuid NOT NULL,
    client_id                     uuid NOT NULL,
    certification_started_at      timestamptz NOT NULL,
    certification_cycle_years     integer NOT NULL DEFAULT 3,
    open_nc_carryover             jsonb NOT NULL DEFAULT '[]'::jsonb,
    complaints_log                jsonb NOT NULL DEFAULT '[]'::jsonb,
    scope_changes                 jsonb NOT NULL DEFAULT '[]'::jsonb,
    last_updated_at               timestamptz NOT NULL DEFAULT now(),
    created_at                    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (firm_id, client_id)
);

CREATE INDEX IF NOT EXISTS surveillance_plans_client_ix
    ON surveillance_plans (client_id);

ALTER TABLE surveillance_plans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='surveillance_plans'
      AND policyname='surveillance_plans_firm_rls'
  ) THEN
    CREATE POLICY surveillance_plans_firm_rls ON surveillance_plans
      USING (firm_id = current_setting('app.current_firm', true)::uuid);
  END IF;
END $$;

-- =========================================================================
-- surveillance_visits
-- =========================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'surveillance_visit_kind') THEN
    CREATE TYPE surveillance_visit_kind AS ENUM (
      'stage1', 'stage2', 'surv1', 'surv2', 'recert', 'special'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'surveillance_visit_status') THEN
    CREATE TYPE surveillance_visit_status AS ENUM (
      'planned', 'in_progress', 'closed', 'overdue', 'cancelled'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS surveillance_visits (
    id                            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id                       uuid NOT NULL,
    plan_id                       uuid NOT NULL REFERENCES surveillance_plans(id) ON DELETE CASCADE,
    client_id                     uuid NOT NULL,
    kind                          surveillance_visit_kind NOT NULL,
    planned_at                    timestamptz NOT NULL,
    planned_duration_days         integer NOT NULL DEFAULT 2,
    status                        surveillance_visit_status NOT NULL DEFAULT 'planned',
    completed_at                  timestamptz,
    lead_auditor_id               uuid,
    notes                         text,
    created_at                    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS surveillance_visits_plan_ix
    ON surveillance_visits (plan_id);
CREATE INDEX IF NOT EXISTS surveillance_visits_planned_ix
    ON surveillance_visits (firm_id, planned_at);

ALTER TABLE surveillance_visits ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='surveillance_visits'
      AND policyname='surveillance_visits_firm_rls'
  ) THEN
    CREATE POLICY surveillance_visits_firm_rls ON surveillance_visits
      USING (firm_id = current_setting('app.current_firm', true)::uuid);
  END IF;
END $$;

-- =========================================================================
-- surveillance_flags
-- =========================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'surveillance_flag_severity') THEN
    CREATE TYPE surveillance_flag_severity AS ENUM ('info', 'warning', 'critical');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS surveillance_flags (
    id                            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id                       uuid NOT NULL,
    plan_id                       uuid REFERENCES surveillance_plans(id) ON DELETE SET NULL,
    client_id                     uuid NOT NULL,
    rule_id                       text NOT NULL,
    severity                      surveillance_flag_severity NOT NULL,
    rationale                     text NOT NULL,
    evidence                      jsonb NOT NULL DEFAULT '{}'::jsonb,
    suggested_action              text NOT NULL,
    raised_at                     timestamptz NOT NULL DEFAULT now(),
    acknowledged_at               timestamptz,
    acknowledged_by               uuid
);

CREATE INDEX IF NOT EXISTS surveillance_flags_client_ix
    ON surveillance_flags (firm_id, client_id, raised_at DESC);
CREATE INDEX IF NOT EXISTS surveillance_flags_open_ix
    ON surveillance_flags (firm_id, severity)
    WHERE acknowledged_at IS NULL;

ALTER TABLE surveillance_flags ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='surveillance_flags'
      AND policyname='surveillance_flags_firm_rls'
  ) THEN
    CREATE POLICY surveillance_flags_firm_rls ON surveillance_flags
      USING (firm_id = current_setting('app.current_firm', true)::uuid);
  END IF;
END $$;

-- =========================================================================
-- web_vitals_samples
-- =========================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'web_vital_name') THEN
    CREATE TYPE web_vital_name AS ENUM ('CLS', 'LCP', 'INP', 'FID', 'TTFB', 'FCP');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS web_vitals_samples (
    id                            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id                       uuid,
    auditor_id                    uuid,
    name                          web_vital_name NOT NULL,
    value                         double precision NOT NULL,
    rating                        text NOT NULL,
    page_path                     text NOT NULL,
    page_url                      text NOT NULL,
    session_id                    text,
    trace_id                      text,
    span_id                       text,
    user_agent                    text,
    occurred_at                   timestamptz NOT NULL,
    received_at                   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS web_vitals_samples_path_ix
    ON web_vitals_samples (page_path, occurred_at DESC);
CREATE INDEX IF NOT EXISTS web_vitals_samples_firm_ix
    ON web_vitals_samples (firm_id, occurred_at DESC);

ALTER TABLE web_vitals_samples ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='web_vitals_samples'
      AND policyname='web_vitals_firm_rls'
  ) THEN
    CREATE POLICY web_vitals_firm_rls ON web_vitals_samples
      USING (
        firm_id IS NULL
        OR firm_id = current_setting('app.current_firm', true)::uuid
      );
  END IF;
END $$;

-- =========================================================================
-- observability_errors
-- =========================================================================

CREATE TABLE IF NOT EXISTS observability_errors (
    id                            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id                       uuid,
    auditor_id                    uuid,
    severity                      text NOT NULL DEFAULT 'error',
    name                          text,
    message                       text NOT NULL,
    stack                         text,
    component_stack               text,
    page_path                     text NOT NULL,
    page_url                      text NOT NULL,
    session_id                    text,
    trace_id                      text,
    span_id                       text,
    user_agent                    text,
    occurred_at                   timestamptz NOT NULL,
    received_at                   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS observability_errors_path_ix
    ON observability_errors (page_path, occurred_at DESC);
CREATE INDEX IF NOT EXISTS observability_errors_firm_ix
    ON observability_errors (firm_id, occurred_at DESC);

ALTER TABLE observability_errors ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='observability_errors'
      AND policyname='observability_errors_firm_rls'
  ) THEN
    CREATE POLICY observability_errors_firm_rls ON observability_errors
      USING (
        firm_id IS NULL
        OR firm_id = current_setting('app.current_firm', true)::uuid
      );
  END IF;
END $$;

COMMIT;
