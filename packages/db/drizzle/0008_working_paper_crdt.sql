-- SPDX-License-Identifier: BUSL-1.1
-- 0008_working_paper_crdt.sql
--
-- Adds the snapshot + update-log tables that back the Yjs CRDT sync gateway
-- for working papers. RLS is firm-scoped to match the rest of the business
-- schema; updates are append-only from the request role.

BEGIN;

CREATE TABLE IF NOT EXISTS working_paper_snapshots (
    working_paper_id    uuid PRIMARY KEY REFERENCES working_papers(id) ON DELETE CASCADE,
    firm_id             uuid NOT NULL,
    engagement_id       uuid NOT NULL,
    snapshot            bytea NOT NULL,
    content_hash        text NOT NULL,
    captured_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS working_paper_snapshots_firm_ix
    ON working_paper_snapshots (firm_id, engagement_id);

CREATE TABLE IF NOT EXISTS working_paper_updates (
    id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    working_paper_id    uuid NOT NULL REFERENCES working_papers(id) ON DELETE CASCADE,
    firm_id             uuid NOT NULL,
    engagement_id       uuid NOT NULL,
    update_bytes        bytea NOT NULL,
    auditor_id          uuid,
    occurred_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS working_paper_updates_wp_ix
    ON working_paper_updates (working_paper_id, occurred_at);
CREATE INDEX IF NOT EXISTS working_paper_updates_firm_ix
    ON working_paper_updates (firm_id, engagement_id);

ALTER TABLE working_paper_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE working_paper_snapshots FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON working_paper_snapshots;
CREATE POLICY tenant_isolation ON working_paper_snapshots
    AS PERMISSIVE FOR ALL TO app_request_role
    USING (firm_id = current_setting('app.current_firm_id', true)::uuid)
    WITH CHECK (firm_id = current_setting('app.current_firm_id', true)::uuid);
DROP POLICY IF EXISTS service_role_passthrough ON working_paper_snapshots;
CREATE POLICY service_role_passthrough ON working_paper_snapshots
    AS PERMISSIVE FOR ALL TO app_service_role
    USING (true) WITH CHECK (true);

ALTER TABLE working_paper_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE working_paper_updates FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON working_paper_updates;
CREATE POLICY tenant_isolation ON working_paper_updates
    AS PERMISSIVE FOR ALL TO app_request_role
    USING (firm_id = current_setting('app.current_firm_id', true)::uuid)
    WITH CHECK (firm_id = current_setting('app.current_firm_id', true)::uuid);
DROP POLICY IF EXISTS service_role_passthrough ON working_paper_updates;
CREATE POLICY service_role_passthrough ON working_paper_updates
    AS PERMISSIVE FOR ALL TO app_service_role
    USING (true) WITH CHECK (true);

COMMIT;
