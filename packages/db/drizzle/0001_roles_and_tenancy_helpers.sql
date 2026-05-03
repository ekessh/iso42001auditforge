-- SPDX-License-Identifier: BUSL-1.1
-- 0001_roles_and_tenancy_helpers.sql
--
-- ADR-0003 Postgres RLS Tenancy — leg 2 (database half).
--
-- Creates the two roles required by the runtime:
--   - app_service_role : LOGIN BYPASSRLS (migrations, worker, seed)
--   - app_request_role : LOGIN, RLS-subject (api requests)
--
-- Defines set_tenant_context / clear_tenant_context functions that the
-- @auditforge/tenancy-core package invokes on every request. Both functions
-- are idempotent and safe to run multiple times.
--
-- Default privileges are wired so that any future business table created by
-- the migration owner automatically grants SELECT/INSERT/UPDATE/DELETE to
-- app_request_role. RLS policies (0002) are still required for actual row
-- visibility — the GRANTs only allow the role to attempt access at all.

BEGIN;

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_service_role') THEN
        CREATE ROLE app_service_role WITH LOGIN BYPASSRLS PASSWORD 'app_service_role';
    ELSE
        ALTER ROLE app_service_role WITH LOGIN BYPASSRLS;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_request_role') THEN
        CREATE ROLE app_request_role WITH LOGIN NOBYPASSRLS PASSWORD 'app_request_role';
    ELSE
        ALTER ROLE app_request_role WITH LOGIN NOBYPASSRLS;
    END IF;
END
$$;

-- Allow the service role to act as the request role when impersonation
-- testing is required (e.g. in vitest harness). NOINHERIT on app_request_role
-- means the service role does not implicitly bypass RLS through it.
GRANT app_request_role TO app_service_role;

-- ---------------------------------------------------------------------------
-- Schema usage + default privileges
-- ---------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO app_request_role;
GRANT USAGE ON SCHEMA public TO app_service_role;

-- Grant on existing objects (idempotent re-grant).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
    TO app_request_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
    TO app_request_role;

-- Future tables/sequences created by the migration owner inherit the same
-- baseline. Policies attached in 0002 will then narrow row-level access.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_request_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO app_request_role;

-- ---------------------------------------------------------------------------
-- Tenant context helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_tenant_context(firm_id uuid, auditor_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM set_config('app.current_firm_id', firm_id::text, true);
    PERFORM set_config('app.current_auditor_id', auditor_id::text, true);
END;
$$;

CREATE OR REPLACE FUNCTION set_engagement_context(engagement_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM set_config('app.current_engagement_id', engagement_id::text, true);
END;
$$;

CREATE OR REPLACE FUNCTION clear_tenant_context()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM set_config('app.current_firm_id', '', true);
    PERFORM set_config('app.current_auditor_id', '', true);
    PERFORM set_config('app.current_engagement_id', '', true);
END;
$$;

-- Tiny helper used by RLS predicates so we never crash on a missing GUC.
CREATE OR REPLACE FUNCTION current_firm_id_or_null()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v text;
BEGIN
    BEGIN
        v := current_setting('app.current_firm_id', true);
    EXCEPTION WHEN others THEN
        RETURN NULL;
    END;
    IF v IS NULL OR v = '' THEN
        RETURN NULL;
    END IF;
    RETURN v::uuid;
END;
$$;

CREATE OR REPLACE FUNCTION current_auditor_id_or_null()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v text;
BEGIN
    BEGIN
        v := current_setting('app.current_auditor_id', true);
    EXCEPTION WHEN others THEN
        RETURN NULL;
    END;
    IF v IS NULL OR v = '' THEN
        RETURN NULL;
    END IF;
    RETURN v::uuid;
END;
$$;

GRANT EXECUTE ON FUNCTION set_tenant_context(uuid, uuid) TO app_request_role, app_service_role;
GRANT EXECUTE ON FUNCTION set_engagement_context(uuid) TO app_request_role, app_service_role;
GRANT EXECUTE ON FUNCTION clear_tenant_context() TO app_request_role, app_service_role;
GRANT EXECUTE ON FUNCTION current_firm_id_or_null() TO app_request_role, app_service_role;
GRANT EXECUTE ON FUNCTION current_auditor_id_or_null() TO app_request_role, app_service_role;

COMMIT;
