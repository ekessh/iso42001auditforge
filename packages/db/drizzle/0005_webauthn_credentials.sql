-- SPDX-License-Identifier: BUSL-1.1
-- 0005_webauthn_credentials.sql
--
-- Introduces the dedicated `webauthn_credentials` table with COSE-binary
-- public key storage (bytea, not base64 text), bigint counter for replay
-- protection, per-row revocation, and full RLS tenant isolation.
--
-- Also adds `status` and `locked_until` columns to `auditors` so the
-- identity service can enforce account lifecycle and rate-limit lockouts at
-- the database layer. A separate `auditor_oidc_identities` table maps
-- issuer+subject pairs to auditor rows (replaces the in-process in-memory
-- map that did not survive restarts).
--
-- Idempotent: all DDL uses IF NOT EXISTS / IF NOT EXISTS type-guards or
-- conditional DO blocks so this migration can be re-applied safely.

BEGIN;

-- =========================================================================
-- 1. auditor_status enum
-- =========================================================================

DO $$ BEGIN
    CREATE TYPE auditor_status AS ENUM ('active', 'suspended', 'disabled');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- =========================================================================
-- 2. auditors — add status + locked_until columns if missing
-- =========================================================================

ALTER TABLE auditors
    ADD COLUMN IF NOT EXISTS status       auditor_status NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS locked_until timestamptz;

-- =========================================================================
-- 3. auditor_oidc_identities — OIDC issuer+subject → auditor mapping
-- =========================================================================

CREATE TABLE IF NOT EXISTS auditor_oidc_identities (
    id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id      uuid        NOT NULL REFERENCES audit_firms(id) ON DELETE CASCADE,
    auditor_id   uuid        NOT NULL REFERENCES auditors(id)   ON DELETE CASCADE,
    issuer       text        NOT NULL,
    subject      text        NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT auditor_oidc_identities_issuer_subject_uq UNIQUE (issuer, subject)
);

CREATE INDEX IF NOT EXISTS auditor_oidc_identities_auditor_ix
    ON auditor_oidc_identities (auditor_id);

-- =========================================================================
-- 4. webauthn_credentials — primary credential store
-- =========================================================================
-- This table replaces the text-encoded `public_key_b64` column in the legacy
-- `auditor_webauthn_credentials` table with:
--   • bytea public_key  — COSE-encoded key, no base64 round-trip
--   • bigint counter    — avoids integer overflow on high-frequency tokens
--   • revoked_at        — soft-delete; queried credentials must have IS NULL
--   • aaguid            — authenticator model fingerprint for risk-scoring
-- The legacy table is left intact for migration continuity.

CREATE TABLE IF NOT EXISTS webauthn_credentials (
    id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id       uuid        NOT NULL REFERENCES audit_firms(id) ON DELETE CASCADE,
    auditor_id    uuid        NOT NULL REFERENCES auditors(id)   ON DELETE CASCADE,
    credential_id text        NOT NULL,
    public_key    bytea       NOT NULL,
    -- Counter starts at 0 and MUST strictly increase with each assertion.
    -- A CHECK constraint at the DB level provides an additional safety net
    -- on top of the application-level monotonicity enforcement.
    counter       bigint      NOT NULL DEFAULT 0
                              CONSTRAINT webauthn_credentials_counter_nonneg CHECK (counter >= 0),
    transports    text[],
    aaguid        uuid,
    user_verified boolean     NOT NULL DEFAULT false,
    created_at    timestamptz NOT NULL DEFAULT now(),
    last_used_at  timestamptz,
    -- Soft-delete: non-null = revoked. Revoked credentials are excluded from
    -- auth lookups but kept for audit trail.
    revoked_at    timestamptz,
    CONSTRAINT webauthn_credentials_credential_id_uq UNIQUE (credential_id)
);

CREATE INDEX IF NOT EXISTS webauthn_credentials_firm_auditor_ix
    ON webauthn_credentials (firm_id, auditor_id);

-- =========================================================================
-- 5. RLS on new tables
-- =========================================================================

ALTER TABLE auditor_oidc_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditor_oidc_identities FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON auditor_oidc_identities;
CREATE POLICY tenant_isolation ON auditor_oidc_identities
    AS PERMISSIVE FOR ALL TO app_request_role
    USING      (firm_id = current_setting('app.current_firm_id', true)::uuid)
    WITH CHECK (firm_id = current_setting('app.current_firm_id', true)::uuid);

DROP POLICY IF EXISTS service_role_passthrough ON auditor_oidc_identities;
CREATE POLICY service_role_passthrough ON auditor_oidc_identities
    AS PERMISSIVE FOR ALL TO app_service_role
    USING (true) WITH CHECK (true);

ALTER TABLE webauthn_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE webauthn_credentials FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON webauthn_credentials;
CREATE POLICY tenant_isolation ON webauthn_credentials
    AS PERMISSIVE FOR ALL TO app_request_role
    USING      (firm_id = current_setting('app.current_firm_id', true)::uuid)
    WITH CHECK (firm_id = current_setting('app.current_firm_id', true)::uuid);

DROP POLICY IF EXISTS service_role_passthrough ON webauthn_credentials;
CREATE POLICY service_role_passthrough ON webauthn_credentials
    AS PERMISSIVE FOR ALL TO app_service_role
    USING (true) WITH CHECK (true);

-- =========================================================================
-- 6. GRANTs
-- =========================================================================

GRANT SELECT, INSERT, UPDATE ON auditor_oidc_identities TO app_request_role;
GRANT SELECT, INSERT, UPDATE ON webauthn_credentials    TO app_request_role;

COMMIT;
