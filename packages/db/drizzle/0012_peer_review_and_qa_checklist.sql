-- SPDX-License-Identifier: BUSL-1.1
-- 0012_peer_review_and_qa_checklist.sql
--
-- Phase 12 tables:
--   * peer_review_packages   — per-engagement review aggregate
--   * peer_review_comments   — append-only thread comments scoped to findings or clauses
--   * qa_checklist_runs      — historical record of evaluations against a draft report
--
-- All tables enforce per-firm RLS using the existing `app.current_firm`
-- session GUC, matching the pattern in 0002_rls_business_tables.sql.
-- Append-only enforcement (where applicable) is layered on top of standard
-- INSERT/UPDATE/DELETE RLS via the trigger pattern from 0004.

BEGIN;

-- =========================================================================
-- peer_review_packages
-- =========================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'peer_review_status') THEN
    CREATE TYPE peer_review_status AS ENUM (
      'pending',
      'in_review',
      'changes_requested',
      'approved',
      'withdrawn'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS peer_review_packages (
    id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id               uuid NOT NULL,
    engagement_id         uuid NOT NULL,
    name                  text NOT NULL,
    status                peer_review_status NOT NULL DEFAULT 'pending',
    primary_auditor_id    uuid NOT NULL,
    reviewer_id           uuid,
    security_review_required boolean NOT NULL DEFAULT false,
    security_reviewer_id  uuid,
    metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    archived_at           timestamptz
);

CREATE INDEX IF NOT EXISTS peer_review_packages_firm_idx
    ON peer_review_packages(firm_id);
CREATE INDEX IF NOT EXISTS peer_review_packages_engagement_idx
    ON peer_review_packages(firm_id, engagement_id);
CREATE INDEX IF NOT EXISTS peer_review_packages_status_idx
    ON peer_review_packages(firm_id, status);

ALTER TABLE peer_review_packages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'peer_review_packages'
      AND policyname = 'peer_review_packages_firm_isolation'
  ) THEN
    CREATE POLICY peer_review_packages_firm_isolation
      ON peer_review_packages
      USING (firm_id = current_setting('app.current_firm', true)::uuid)
      WITH CHECK (firm_id = current_setting('app.current_firm', true)::uuid);
  END IF;
END $$;

-- =========================================================================
-- peer_review_comments
-- =========================================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'peer_review_comment_flag') THEN
    CREATE TYPE peer_review_comment_flag AS ENUM ('standard', 'security', 'data-protection');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS peer_review_comments (
    id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id           uuid NOT NULL,
    package_id        uuid NOT NULL REFERENCES peer_review_packages(id) ON DELETE RESTRICT,
    parent_id         uuid REFERENCES peer_review_comments(id) ON DELETE RESTRICT,
    author_id         uuid NOT NULL,
    -- scope is JSONB (kind=finding|clause|global + payload)
    scope             jsonb NOT NULL,
    body              text NOT NULL,
    flag              peer_review_comment_flag NOT NULL DEFAULT 'standard',
    created_at        timestamptz NOT NULL DEFAULT now(),
    resolved_at       timestamptz,
    resolved_by       uuid,
    resolution_note   text
);

CREATE INDEX IF NOT EXISTS peer_review_comments_firm_idx
    ON peer_review_comments(firm_id);
CREATE INDEX IF NOT EXISTS peer_review_comments_pkg_idx
    ON peer_review_comments(firm_id, package_id);
CREATE INDEX IF NOT EXISTS peer_review_comments_open_idx
    ON peer_review_comments(firm_id, package_id) WHERE resolved_at IS NULL;

ALTER TABLE peer_review_comments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'peer_review_comments'
      AND policyname = 'peer_review_comments_firm_isolation'
  ) THEN
    CREATE POLICY peer_review_comments_firm_isolation
      ON peer_review_comments
      USING (firm_id = current_setting('app.current_firm', true)::uuid)
      WITH CHECK (firm_id = current_setting('app.current_firm', true)::uuid);
  END IF;
END $$;

-- Append-only on body / scope / parent — the only mutation allowed is
-- resolve, which sets resolved_at + resolved_by + resolution_note.
CREATE OR REPLACE FUNCTION peer_review_comments_immutable_body()
RETURNS trigger AS $$
BEGIN
  IF NEW.body IS DISTINCT FROM OLD.body THEN
    RAISE EXCEPTION 'peer_review_comments.body is immutable';
  END IF;
  IF NEW.scope IS DISTINCT FROM OLD.scope THEN
    RAISE EXCEPTION 'peer_review_comments.scope is immutable';
  END IF;
  IF NEW.parent_id IS DISTINCT FROM OLD.parent_id THEN
    RAISE EXCEPTION 'peer_review_comments.parent_id is immutable';
  END IF;
  IF NEW.author_id IS DISTINCT FROM OLD.author_id THEN
    RAISE EXCEPTION 'peer_review_comments.author_id is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS peer_review_comments_immutable_body_trigger ON peer_review_comments;
CREATE TRIGGER peer_review_comments_immutable_body_trigger
  BEFORE UPDATE ON peer_review_comments
  FOR EACH ROW EXECUTE FUNCTION peer_review_comments_immutable_body();

-- =========================================================================
-- qa_checklist_runs
-- =========================================================================

CREATE TABLE IF NOT EXISTS qa_checklist_runs (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id         uuid NOT NULL,
    engagement_id   uuid NOT NULL,
    report_id       uuid NOT NULL,
    actor_id        uuid NOT NULL,
    passed          boolean NOT NULL,
    items           jsonb NOT NULL,
    failed_item_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
    overrides       jsonb NOT NULL DEFAULT '{}'::jsonb,
    evaluated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS qa_checklist_runs_firm_idx
    ON qa_checklist_runs(firm_id);
CREATE INDEX IF NOT EXISTS qa_checklist_runs_report_idx
    ON qa_checklist_runs(firm_id, report_id);

ALTER TABLE qa_checklist_runs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'qa_checklist_runs'
      AND policyname = 'qa_checklist_runs_firm_isolation'
  ) THEN
    CREATE POLICY qa_checklist_runs_firm_isolation
      ON qa_checklist_runs
      USING (firm_id = current_setting('app.current_firm', true)::uuid)
      WITH CHECK (firm_id = current_setting('app.current_firm', true)::uuid);
  END IF;
END $$;

COMMIT;
