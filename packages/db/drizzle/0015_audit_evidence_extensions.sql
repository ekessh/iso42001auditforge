-- SPDX-License-Identifier: BUSL-1.1
-- 0013_audit_evidence_extensions.sql
--
-- Phase 13 — extend `probe_executions` with three columns sourced from the
-- audit-evidence-runner sidecar:
--   * severity              — info|low|medium|high|critical (top-level severity
--                              for finding/triage dashboards)
--   * evidence_artifacts    — array of artifact descriptors (path, mime,
--                              sha256, byte size) emitted by the sidecar.
--   * terminated_by_budget  — true when the sidecar tripped a budget axis.
--
-- We keep these as nullable columns so existing rows remain valid; new rows
-- written by the worker that polls the sidecar populate them.

BEGIN;

ALTER TABLE probe_executions
  ADD COLUMN IF NOT EXISTS severity TEXT,
  ADD COLUMN IF NOT EXISTS evidence_artifacts JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS terminated_by_budget BOOLEAN NOT NULL DEFAULT FALSE;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'probe_executions_severity_check'
  ) THEN
    ALTER TABLE probe_executions
      ADD CONSTRAINT probe_executions_severity_check
      CHECK (severity IS NULL OR severity IN ('info', 'low', 'medium', 'high', 'critical'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS probe_executions_severity_ix
  ON probe_executions (severity)
  WHERE severity IS NOT NULL;

CREATE INDEX IF NOT EXISTS probe_executions_terminated_by_budget_ix
  ON probe_executions (terminated_by_budget)
  WHERE terminated_by_budget = TRUE;

COMMIT;
