-- SPDX-License-Identifier: BUSL-1.1
-- 0007_ledger_signing_tsa_outbox.sql
--
-- Bring `audit_ledger_events` schema up to the v3 hash-chain + TSA + Ed25519 design
-- and add the `ledger_outbox` table that lets domain services emit events into
-- the same DB transaction as their state mutations (the AuditLedgerService
-- consumer drains the outbox into the ledger).
--
-- Belt-and-braces: only `app_ledger_admin` is allowed to UPDATE / DELETE
-- audit_ledger_events. We add the role here so 0004's append-only triggers
-- can be relaxed only when an explicit ledger admin session is in use. The
-- triggers in 0004 still fire for everyone else.

BEGIN;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_ledger_admin') THEN
    CREATE ROLE app_ledger_admin;
  END IF;
END $$;

ALTER TABLE audit_ledger_events
    ADD COLUMN IF NOT EXISTS schema_version  smallint NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS producer        text,
    ADD COLUMN IF NOT EXISTS chain_hash      text,
    ADD COLUMN IF NOT EXISTS tsa_token       jsonb,
    ADD COLUMN IF NOT EXISTS signer_key_id   text,
    ADD COLUMN IF NOT EXISTS public_key      text;

UPDATE audit_ledger_events SET chain_hash = hash WHERE chain_hash IS NULL;

ALTER TABLE audit_ledger_events
    ALTER COLUMN chain_hash SET NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'audit_ledger_events_firm_seq_unique'
  ) THEN
    ALTER TABLE audit_ledger_events
      ADD CONSTRAINT audit_ledger_events_firm_seq_unique UNIQUE (firm_id, sequence);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION raise_append_only_strict()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF current_user = 'app_ledger_admin' THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION
        'append-only table %.% does not permit % operations',
        TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP
        USING ERRCODE = 'feature_not_supported';
END;
$$;

DROP TRIGGER IF EXISTS audit_ledger_events_no_update ON audit_ledger_events;
CREATE TRIGGER audit_ledger_events_no_update
    BEFORE UPDATE ON audit_ledger_events
    FOR EACH ROW EXECUTE FUNCTION raise_append_only_strict();

DROP TRIGGER IF EXISTS audit_ledger_events_no_delete ON audit_ledger_events;
CREATE TRIGGER audit_ledger_events_no_delete
    BEFORE DELETE ON audit_ledger_events
    FOR EACH ROW EXECUTE FUNCTION raise_append_only_strict();

CREATE TABLE IF NOT EXISTS ledger_outbox (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id         uuid NOT NULL,
    engagement_id   uuid,
    auditor_id      uuid,
    producer        text NOT NULL,
    event_type      text NOT NULL,
    schema_version  smallint NOT NULL DEFAULT 1,
    payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
    apply_tsa       boolean NOT NULL DEFAULT false,
    status          text NOT NULL DEFAULT 'pending',
    attempts        integer NOT NULL DEFAULT 0,
    last_error      text,
    enqueued_at     timestamptz NOT NULL DEFAULT now(),
    consumed_at     timestamptz,
    ledger_event_id uuid
);

CREATE INDEX IF NOT EXISTS ledger_outbox_firm_status_ix
    ON ledger_outbox (firm_id, status, enqueued_at);

ALTER TABLE ledger_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_outbox FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON ledger_outbox;
CREATE POLICY tenant_isolation ON ledger_outbox
    USING (firm_id = current_setting('app.current_firm_id', true)::uuid);

COMMIT;
