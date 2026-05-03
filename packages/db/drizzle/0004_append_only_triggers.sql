-- SPDX-License-Identifier: BUSL-1.1
-- 0004_append_only_triggers.sql
--
-- Defense-in-depth trigger layer for the two append-only tables.
--
-- The RLS policies in 0002 already prevent app_request_role from issuing
-- UPDATE / DELETE because no policy permits those operations. These triggers
-- provide a second, role-independent guard: they fire BEFORE UPDATE / DELETE
-- on audit_ledger_events and audit_file_archives and raise an exception
-- regardless of the connecting role.
--
-- This is intentional belt-and-braces:
--   - If a future migration ever drops the FORCE ROW LEVEL SECURITY flag,
--     the trigger still bites.
--   - If app_service_role (which has BYPASSRLS) is mis-used to run UPDATE
--     against the ledger, the trigger still bites.
--   - If a superuser session is used directly, the trigger still bites
--     unless explicitly disabled (DISABLE TRIGGER, audited).
--
-- Tests in tests/rls.test.ts assert UPDATE / DELETE raise from both
-- app_request_role (RLS bites first) and app_service_role (trigger bites).

CREATE OR REPLACE FUNCTION raise_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'append-only table %.% does not permit % operations',
        TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP
        USING ERRCODE = 'feature_not_supported';
END;
$$;

-- audit_ledger_events
DROP TRIGGER IF EXISTS audit_ledger_events_no_update ON audit_ledger_events;
CREATE TRIGGER audit_ledger_events_no_update
    BEFORE UPDATE ON audit_ledger_events
    FOR EACH ROW EXECUTE FUNCTION raise_append_only();

DROP TRIGGER IF EXISTS audit_ledger_events_no_delete ON audit_ledger_events;
CREATE TRIGGER audit_ledger_events_no_delete
    BEFORE DELETE ON audit_ledger_events
    FOR EACH ROW EXECUTE FUNCTION raise_append_only();

DROP TRIGGER IF EXISTS audit_ledger_events_no_truncate ON audit_ledger_events;
CREATE TRIGGER audit_ledger_events_no_truncate
    BEFORE TRUNCATE ON audit_ledger_events
    FOR EACH STATEMENT EXECUTE FUNCTION raise_append_only();

-- audit_file_archives
DROP TRIGGER IF EXISTS audit_file_archives_no_update ON audit_file_archives;
CREATE TRIGGER audit_file_archives_no_update
    BEFORE UPDATE ON audit_file_archives
    FOR EACH ROW EXECUTE FUNCTION raise_append_only();

DROP TRIGGER IF EXISTS audit_file_archives_no_delete ON audit_file_archives;
CREATE TRIGGER audit_file_archives_no_delete
    BEFORE DELETE ON audit_file_archives
    FOR EACH ROW EXECUTE FUNCTION raise_append_only();

DROP TRIGGER IF EXISTS audit_file_archives_no_truncate ON audit_file_archives;
CREATE TRIGGER audit_file_archives_no_truncate
    BEFORE TRUNCATE ON audit_file_archives
    FOR EACH STATEMENT EXECUTE FUNCTION raise_append_only();
