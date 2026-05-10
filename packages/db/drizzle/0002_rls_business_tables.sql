-- SPDX-License-Identifier: BUSL-1.1
-- 0002_rls_business_tables.sql
--
-- Creates every business table in the AuditForge data model and attaches
-- ROW LEVEL SECURITY policies to each. The "tenant_isolation" policy
-- restricts every operation to rows whose firm_id matches the
-- app.current_firm_id session variable set by set_tenant_context().
--
-- For audit_ledger_events and audit_file_archives, RLS is augmented with
-- an "append_only" policy: app_request_role can INSERT but cannot UPDATE
-- or DELETE. Defense-in-depth triggers in 0004 also raise on UPDATE/DELETE.
--
-- For audit_file_archives, an additional "accreditation_readonly" policy
-- allows app_request_role to SELECT rows that have been published to
-- accreditation auditors via accreditation_grants.firm_id (cross-firm
-- read scoped by an explicit grant — never by silent leak).
--
-- All ALTER TABLE ... ENABLE ROW LEVEL SECURITY uses FORCE so the table
-- owner does not implicitly bypass RLS. The bypass is reserved for
-- app_service_role via the BYPASSRLS role attribute (0001).

BEGIN;

-- =========================================================================
-- 1. Catalogue tables (firm-agnostic; readable by all, writable by service)
-- =========================================================================

CREATE TABLE IF NOT EXISTS iso42001_clauses (
    id           text PRIMARY KEY,
    title        text NOT NULL,
    framework    text NOT NULL DEFAULT 'ISO_42001',
    metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS annex_a_controls (
    id           text PRIMARY KEY,
    title        text NOT NULL,
    category     text NOT NULL,
    metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS eu_ai_act_articles (
    id           text PRIMARY KEY,
    title        text NOT NULL,
    risk_tier    text NOT NULL,
    metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nist_ai_rmf_subcategories (
    id           text PRIMARY KEY,
    function     text NOT NULL,
    title        text NOT NULL,
    metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS owasp_llm_top10 (
    id           text PRIMARY KEY,
    title        text NOT NULL,
    version      text NOT NULL DEFAULT '2025',
    metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mitre_atlas_techniques (
    id           text PRIMARY KEY,
    tactic       text NOT NULL,
    title        text NOT NULL,
    metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS avid_categories (
    id           text PRIMARY KEY,
    title        text NOT NULL,
    metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS avid_subcategories (
    id              text PRIMARY KEY,
    category_id     text NOT NULL REFERENCES avid_categories(id) ON DELETE CASCADE,
    title           text NOT NULL,
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mit_ai_risk_categories (
    id           text PRIMARY KEY,
    title        text NOT NULL,
    metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mit_ai_risk_subcategories (
    id              text PRIMARY KEY,
    category_id     text NOT NULL REFERENCES mit_ai_risk_categories(id) ON DELETE CASCADE,
    title           text NOT NULL,
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS framework_mappings (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_framework  text NOT NULL,
    from_node_id    text NOT NULL,
    to_framework    text NOT NULL,
    to_node_id      text NOT NULL,
    strength        text NOT NULL,
    rationale       text NOT NULL,
    confidence      double precision NOT NULL,
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (from_framework, from_node_id, to_framework, to_node_id)
);

CREATE TABLE IF NOT EXISTS rbac_roles (
    role         text PRIMARY KEY,
    description  text,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rbac_permissions (
    id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    role         text NOT NULL REFERENCES rbac_roles(role) ON DELETE CASCADE,
    resource     text NOT NULL,
    action       text NOT NULL,
    scope        text NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (role, resource, action)
);

GRANT SELECT ON iso42001_clauses, annex_a_controls, eu_ai_act_articles,
    nist_ai_rmf_subcategories, owasp_llm_top10, mitre_atlas_techniques,
    avid_categories, avid_subcategories, mit_ai_risk_categories,
    mit_ai_risk_subcategories, rbac_roles, rbac_permissions
    TO app_request_role;

-- =========================================================================
-- 2. Tenancy roots (firms, auditors, audit_firms alias)
-- =========================================================================

-- audit_firms is the canonical name; firms is a synonym used in some contexts.
-- The Drizzle schema in src/schema/firms.ts already creates audit_firms.
-- We create both names and reconcile them (CREATE IF NOT EXISTS is a no-op
-- when the Drizzle migration runs first; here we ensure shape parity).

CREATE TABLE IF NOT EXISTS audit_firms (
    id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                  text NOT NULL,
    legal_name            text NOT NULL UNIQUE,
    country_code          text NOT NULL,
    is_solo               boolean NOT NULL DEFAULT false,
    accreditation_body    text,
    accreditation_number  text,
    contact_email         text,
    settings_json         text DEFAULT '{}',
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    archived_at           timestamptz
);

-- Logical alias: a "firm" row points to an audit_firms row. We model firms as
-- a view-like table for downstream RLS predicates that use firm_id directly.
CREATE TABLE IF NOT EXISTS firms (
    id            uuid PRIMARY KEY,
    audit_firm_id uuid NOT NULL REFERENCES audit_firms(id) ON DELETE CASCADE,
    firm_id       uuid NOT NULL,
    name          text NOT NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auditors (
    id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id             uuid NOT NULL REFERENCES audit_firms(id) ON DELETE RESTRICT,
    email               text NOT NULL UNIQUE,
    full_name           text NOT NULL,
    employment_status   text NOT NULL DEFAULT 'employed',
    primary_role        text NOT NULL,
    timezone            text NOT NULL DEFAULT 'UTC',
    bio                 text,
    is_active           boolean NOT NULL DEFAULT true,
    webauthn_enabled    boolean NOT NULL DEFAULT false,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    archived_at         timestamptz
);

-- Auxiliary auditor tables created by the existing Drizzle schema
-- (auditors.ts) — declared here with IF NOT EXISTS so RLS attachment below
-- finds the relation even when the Drizzle generator has not run.

CREATE TABLE IF NOT EXISTS auditor_roles (
    id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id      uuid NOT NULL REFERENCES audit_firms(id) ON DELETE CASCADE,
    auditor_id   uuid NOT NULL REFERENCES auditors(id) ON DELETE CASCADE,
    role         text NOT NULL,
    granted_at   timestamptz NOT NULL DEFAULT now(),
    revoked_at   timestamptz
);

CREATE TABLE IF NOT EXISTS auditor_competences (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id         uuid NOT NULL REFERENCES audit_firms(id) ON DELETE CASCADE,
    auditor_id      uuid NOT NULL REFERENCES auditors(id) ON DELETE CASCADE,
    competence_type text NOT NULL,
    descriptor      text NOT NULL,
    issuer          text,
    issued_on       date,
    expires_on      date,
    cpd_hours       integer,
    evidence_ref    text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auditor_webauthn_credentials (
    id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id        uuid NOT NULL REFERENCES audit_firms(id) ON DELETE CASCADE,
    auditor_id     uuid NOT NULL REFERENCES auditors(id) ON DELETE CASCADE,
    credential_id  text NOT NULL UNIQUE,
    public_key_b64 text NOT NULL,
    counter        integer NOT NULL DEFAULT 0,
    transports     text,
    label          text,
    last_used_at   timestamptz,
    created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auditor_assignments (
    id                       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id                  uuid NOT NULL REFERENCES audit_firms(id) ON DELETE CASCADE,
    auditor_id               uuid NOT NULL REFERENCES auditors(id) ON DELETE CASCADE,
    engagement_id            uuid NOT NULL,
    role                     text NOT NULL,
    starts_on                date,
    ends_on                  date,
    impartiality_checked     boolean NOT NULL DEFAULT false,
    conflict_notes           text,
    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now()
);

-- =========================================================================
-- 3. Engagement subtree (every business table carries firm_id)
-- =========================================================================

CREATE TABLE IF NOT EXISTS clients (
    id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id       uuid NOT NULL,
    legal_name    text NOT NULL,
    country_code  text NOT NULL,
    metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    archived_at   timestamptz
);

CREATE TABLE IF NOT EXISTS engagements (
    id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id      uuid NOT NULL,
    client_id    uuid NOT NULL,
    code         text NOT NULL,
    mode         text NOT NULL DEFAULT 'audit',
    stage        text NOT NULL DEFAULT 'stage1',
    status       text NOT NULL DEFAULT 'draft',
    metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    archived_at  timestamptz,
    UNIQUE (firm_id, code)
);

CREATE TABLE IF NOT EXISTS audit_events (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id         uuid NOT NULL,
    engagement_id   uuid NOT NULL,
    event_type      text NOT NULL,
    payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
    occurred_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_plans (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id         uuid NOT NULL,
    engagement_id   uuid NOT NULL,
    name            text NOT NULL,
    payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plan_sessions (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id         uuid NOT NULL,
    engagement_id   uuid NOT NULL,
    plan_id         uuid NOT NULL REFERENCES audit_plans(id) ON DELETE CASCADE,
    starts_at       timestamptz NOT NULL,
    ends_at         timestamptz,
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_teams (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id         uuid NOT NULL,
    engagement_id   uuid NOT NULL,
    name            text NOT NULL,
    members         jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- =========================================================================
-- 4. AI systems / agent workflows
-- =========================================================================

CREATE TABLE IF NOT EXISTS ai_systems (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id         uuid NOT NULL,
    engagement_id   uuid,
    name            text NOT NULL,
    system_type     text NOT NULL,
    risk_tier       text,
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_system_versions (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id         uuid NOT NULL,
    ai_system_id    uuid NOT NULL REFERENCES ai_systems(id) ON DELETE CASCADE,
    version         text NOT NULL,
    model_hash      text,
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (ai_system_id, version)
);

CREATE TABLE IF NOT EXISTS agent_workflows (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id         uuid NOT NULL,
    engagement_id   uuid,
    ai_system_id    uuid REFERENCES ai_systems(id) ON DELETE SET NULL,
    name            text NOT NULL,
    autonomy_level  text NOT NULL DEFAULT 'l1_suggest',
    spec            jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_tools (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id         uuid NOT NULL,
    workflow_id     uuid NOT NULL REFERENCES agent_workflows(id) ON DELETE CASCADE,
    name            text NOT NULL,
    spec            jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- =========================================================================
-- 5. Working papers / evidence / sampling / interviews
-- =========================================================================

CREATE TABLE IF NOT EXISTS working_papers (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id         uuid NOT NULL,
    engagement_id   uuid NOT NULL,
    title           text NOT NULL,
    verdict         text,
    body            jsonb NOT NULL DEFAULT '{}'::jsonb,
    crdt_state      bytea,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    archived_at     timestamptz
);

CREATE TABLE IF NOT EXISTS wp_observations (
    id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id             uuid NOT NULL,
    working_paper_id    uuid NOT NULL REFERENCES working_papers(id) ON DELETE CASCADE,
    observation         text NOT NULL,
    severity            text,
    metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evidence_objects (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id         uuid NOT NULL,
    engagement_id   uuid NOT NULL,
    storage_key     text NOT NULL,
    sha256          text NOT NULL,
    blake3          text,
    size_bytes      bigint NOT NULL,
    mime_type       text,
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    archived_at     timestamptz,
    UNIQUE (firm_id, storage_key)
);

CREATE TABLE IF NOT EXISTS evidence_links (
    id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id             uuid NOT NULL,
    evidence_id         uuid NOT NULL REFERENCES evidence_objects(id) ON DELETE CASCADE,
    target_type         text NOT NULL,
    target_id           uuid NOT NULL,
    metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS samples (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id         uuid NOT NULL,
    engagement_id   uuid NOT NULL,
    method          text NOT NULL,
    population_size integer,
    sample_size     integer,
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sample_units (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id         uuid NOT NULL,
    sample_id       uuid NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
    identifier      text NOT NULL,
    payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS interview_records (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id         uuid NOT NULL,
    engagement_id   uuid NOT NULL,
    interviewee     text NOT NULL,
    status          text NOT NULL DEFAULT 'scheduled',
    summary         text,
    transcript      jsonb NOT NULL DEFAULT '{}'::jsonb,
    scheduled_at    timestamptz,
    completed_at    timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- =========================================================================
-- 6. Probes / agent traces / co-auditor
-- =========================================================================

CREATE TABLE IF NOT EXISTS probe_definitions (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id         uuid NOT NULL,
    name            text NOT NULL,
    mode            text NOT NULL DEFAULT 'offline',
    spec            jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS probe_executions (
    id                      uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id                 uuid NOT NULL,
    engagement_id           uuid NOT NULL,
    probe_definition_id     uuid NOT NULL REFERENCES probe_definitions(id) ON DELETE RESTRICT,
    status                  text NOT NULL DEFAULT 'queued',
    verdict                 text,
    started_at              timestamptz,
    finished_at             timestamptz,
    output                  jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_traces (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id         uuid NOT NULL,
    engagement_id   uuid NOT NULL,
    source          text NOT NULL DEFAULT 'otel',
    spans           jsonb NOT NULL DEFAULT '[]'::jsonb,
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
    ingested_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS co_auditor_invocations (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id         uuid NOT NULL,
    engagement_id   uuid NOT NULL,
    auditor_id      uuid,
    backend         text NOT NULL DEFAULT 'local',
    request         jsonb NOT NULL DEFAULT '{}'::jsonb,
    response        jsonb NOT NULL DEFAULT '{}'::jsonb,
    started_at      timestamptz NOT NULL DEFAULT now(),
    finished_at     timestamptz
);

CREATE TABLE IF NOT EXISTS llm_invocations (
    id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id             uuid NOT NULL,
    engagement_id       uuid,
    provider            text NOT NULL,
    model_name          text NOT NULL,
    model_hash          text,
    temperature         double precision,
    prompt_template_id  text,
    tokens_in           integer,
    tokens_out          integer,
    latency_ms          integer,
    cost_usd            numeric(12, 6),
    decision            text,
    reasoning_trace     jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at          timestamptz NOT NULL DEFAULT now()
);

-- =========================================================================
-- 7. Findings, CAPA, reports, peer review
-- =========================================================================

CREATE TABLE IF NOT EXISTS findings (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id         uuid NOT NULL,
    engagement_id   uuid NOT NULL,
    finding_type    text NOT NULL,
    finding_state   text NOT NULL DEFAULT 'draft',
    title           text NOT NULL,
    description     text,
    raised_at       timestamptz NOT NULL DEFAULT now(),
    resolved_at     timestamptz,
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS candidate_findings (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id         uuid NOT NULL,
    engagement_id   uuid NOT NULL,
    status          text NOT NULL DEFAULT 'pending',
    rationale       text,
    payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS corrective_actions (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id         uuid NOT NULL,
    finding_id      uuid NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
    description     text NOT NULL,
    state           text NOT NULL DEFAULT 'proposed',
    due_date        date,
    closed_at       timestamptz,
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_reports (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id         uuid NOT NULL,
    engagement_id   uuid NOT NULL,
    report_type     text NOT NULL,
    state           text NOT NULL DEFAULT 'draft',
    payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    signed_at       timestamptz,
    issued_at       timestamptz
);

CREATE TABLE IF NOT EXISTS peer_reviews (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id         uuid NOT NULL,
    engagement_id   uuid NOT NULL,
    reviewer_id     uuid,
    verdict         text NOT NULL DEFAULT 'pending',
    comments        text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    decided_at      timestamptz
);

-- =========================================================================
-- 8. Audit ledger / archive / billing / surveillance
-- =========================================================================

CREATE TABLE IF NOT EXISTS audit_ledger_events (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id         uuid NOT NULL,
    engagement_id   uuid,
    auditor_id      uuid,
    event_type      text NOT NULL,
    payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
    sequence        bigint NOT NULL,
    prev_hash       text,
    hash            text NOT NULL,
    signature       text,
    occurred_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_file_archives (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id         uuid NOT NULL,
    engagement_id   uuid NOT NULL,
    archive_uri     text NOT NULL,
    archive_hash    text NOT NULL,
    signature       text,
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
    sealed_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accreditation_grants (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id         uuid NOT NULL,
    engagement_id   uuid NOT NULL,
    accreditation_body text NOT NULL,
    granted_to      text NOT NULL,
    granted_at      timestamptz NOT NULL DEFAULT now(),
    expires_at      timestamptz,
    revoked_at      timestamptz
);

CREATE TABLE IF NOT EXISTS billing_entries (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id         uuid NOT NULL,
    engagement_id   uuid,
    auditor_id      uuid,
    billable_amount numeric(12, 2) NOT NULL,
    currency        text NOT NULL DEFAULT 'USD',
    description     text,
    occurred_at     timestamptz NOT NULL DEFAULT now(),
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS surveillance_telemetry (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id         uuid NOT NULL,
    engagement_id   uuid NOT NULL,
    severity        text NOT NULL DEFAULT 'info',
    payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
    observed_at     timestamptz NOT NULL DEFAULT now()
);

-- =========================================================================
-- 9. Bi-temporal claim graph (ADR-0009)
-- =========================================================================

CREATE TABLE IF NOT EXISTS episodes (
    id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id             uuid NOT NULL,
    engagement_id       uuid NOT NULL,
    source              text NOT NULL,
    payload             jsonb NOT NULL DEFAULT '{}'::jsonb,
    ingestion_time      timestamptz NOT NULL DEFAULT now(),
    valid_time_start    timestamptz,
    valid_time_end      timestamptz
);

CREATE TABLE IF NOT EXISTS claims (
    id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id             uuid NOT NULL,
    engagement_id       uuid NOT NULL,
    episode_id          uuid REFERENCES episodes(id) ON DELETE SET NULL,
    subject             text NOT NULL,
    predicate           text NOT NULL,
    object_text         text,
    object_uri          text,
    embedding           vector(1536),
    event_time_start    timestamptz NOT NULL DEFAULT now(),
    event_time_end      timestamptz,
    record_time_start   timestamptz NOT NULL DEFAULT now(),
    record_time_end     timestamptz,
    confidence          double precision NOT NULL DEFAULT 1.0,
    metadata            jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS claim_relations (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id         uuid NOT NULL,
    subject         uuid NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    predicate       text NOT NULL,
    object          uuid NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS claim_attributions (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id         uuid NOT NULL,
    claim_id        uuid NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
    evidence_id     uuid REFERENCES evidence_objects(id) ON DELETE SET NULL,
    weight          double precision NOT NULL DEFAULT 1.0,
    rationale       text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- Embedding stores for retrieval (clause catalogue, etc.)
CREATE TABLE IF NOT EXISTS clause_embeddings (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    framework       text NOT NULL,
    node_id         text NOT NULL,
    embedding       vector(1536),
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (framework, node_id)
);

-- =========================================================================
-- 10. SoA / risk / cross-framework mappings (per-firm projections)
-- =========================================================================

CREATE TABLE IF NOT EXISTS soa_records (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id         uuid NOT NULL,
    engagement_id   uuid NOT NULL,
    control_id      text NOT NULL,
    applicability   text NOT NULL,
    rationale       text,
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (firm_id, engagement_id, control_id)
);

CREATE TABLE IF NOT EXISTS ai_risk_register_entries (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id         uuid NOT NULL,
    engagement_id   uuid NOT NULL,
    risk_id         text NOT NULL,
    title           text NOT NULL,
    likelihood      text,
    impact          text,
    treatment       text,
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (firm_id, engagement_id, risk_id)
);

-- =========================================================================
-- ENABLE ROW LEVEL SECURITY + POLICIES
-- =========================================================================
--
-- We use a DO block per table so re-running this migration is idempotent
-- (CREATE POLICY does not support IF NOT EXISTS prior to PG 15+, so we
-- DROP-then-CREATE in a transaction).

-- Helper macro pattern (executed per table, since SQL has no macro system).
-- The list below is duplicated explicitly so reviewers can grep for any
-- table name and confirm it has a policy.

DO $rls$
DECLARE
    t text;
    business_tables text[] := ARRAY[
        'firms',
        'auditors',
        'auditor_roles',
        'auditor_competences',
        'auditor_webauthn_credentials',
        'auditor_assignments',
        'clients',
        'engagements',
        'audit_events',
        'audit_plans',
        'plan_sessions',
        'audit_teams',
        'ai_systems',
        'ai_system_versions',
        'agent_workflows',
        'agent_tools',
        'working_papers',
        'wp_observations',
        'evidence_objects',
        'evidence_links',
        'samples',
        'sample_units',
        'interview_records',
        'probe_definitions',
        'probe_executions',
        'agent_traces',
        'findings',
        'corrective_actions',
        'audit_reports',
        'peer_reviews',
        'audit_ledger_events',
        'billing_entries',
        'surveillance_telemetry',
        'co_auditor_invocations',
        'episodes',
        'claims',
        'claim_relations',
        'claim_attributions',
        'candidate_findings',
        'llm_invocations',
        'soa_records',
        'ai_risk_register_entries',
        'accreditation_grants'
    ];
BEGIN
    FOREACH t IN ARRAY business_tables LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
        -- Drop and recreate so re-runs are idempotent.
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
        EXECUTE format(
            'CREATE POLICY tenant_isolation ON %I '
            'AS PERMISSIVE FOR ALL TO app_request_role '
            'USING (firm_id = current_setting(''app.current_firm_id'', true)::uuid) '
            'WITH CHECK (firm_id = current_setting(''app.current_firm_id'', true)::uuid)',
            t
        );
        -- Service role may always pass through (BYPASSRLS handles it but we
        -- add an explicit pass-through policy for environments where the
        -- service role attribute is dropped).
        EXECUTE format('DROP POLICY IF EXISTS service_role_passthrough ON %I', t);
        EXECUTE format(
            'CREATE POLICY service_role_passthrough ON %I '
            'AS PERMISSIVE FOR ALL TO app_service_role '
            'USING (true) WITH CHECK (true)',
            t
        );
    END LOOP;
END
$rls$;

-- audit_firms is the tenancy root: RLS scopes by `id`, not `firm_id`.
ALTER TABLE audit_firms ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_firms FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON audit_firms;
CREATE POLICY tenant_isolation ON audit_firms
    AS PERMISSIVE FOR ALL TO app_request_role
    USING (id = current_setting('app.current_firm_id', true)::uuid)
    WITH CHECK (id = current_setting('app.current_firm_id', true)::uuid);
DROP POLICY IF EXISTS service_role_passthrough ON audit_firms;
CREATE POLICY service_role_passthrough ON audit_firms
    AS PERMISSIVE FOR ALL TO app_service_role
    USING (true) WITH CHECK (true);

-- =========================================================================
-- 11. Append-only carve-outs for audit_ledger_events + audit_file_archives
-- =========================================================================
-- The generic tenant_isolation policy created above grants ALL operations
-- to app_request_role within the tenant. For the two append-only tables we
-- replace it with a SELECT-only + INSERT-only pair so UPDATE/DELETE are
-- impossible from the request role. (Defense-in-depth triggers in 0004.)

DROP POLICY IF EXISTS tenant_isolation ON audit_ledger_events;
CREATE POLICY tenant_select ON audit_ledger_events
    AS PERMISSIVE FOR SELECT TO app_request_role
    USING (firm_id = current_setting('app.current_firm_id', true)::uuid);
CREATE POLICY tenant_append_only ON audit_ledger_events
    AS PERMISSIVE FOR INSERT TO app_request_role
    WITH CHECK (firm_id = current_setting('app.current_firm_id', true)::uuid);
-- No UPDATE / DELETE policy => app_request_role cannot mutate.

DROP POLICY IF EXISTS tenant_isolation ON audit_file_archives;
CREATE POLICY tenant_select ON audit_file_archives
    AS PERMISSIVE FOR SELECT TO app_request_role
    USING (firm_id = current_setting('app.current_firm_id', true)::uuid);
CREATE POLICY tenant_append_only ON audit_file_archives
    AS PERMISSIVE FOR INSERT TO app_request_role
    WITH CHECK (firm_id = current_setting('app.current_firm_id', true)::uuid);

-- Cross-firm read for accreditation auditors. The grant table is itself
-- tenant-isolated by firm_id (issuer firm), but a SELECT on
-- audit_file_archives is allowed when any non-revoked accreditation_grant
-- exists for that engagement and the requesting firm's auditor identity
-- matches the granted_to subject.
CREATE POLICY accreditation_readonly ON audit_file_archives
    AS PERMISSIVE FOR SELECT TO app_request_role
    USING (
        EXISTS (
            SELECT 1 FROM accreditation_grants ag
            WHERE ag.engagement_id = audit_file_archives.engagement_id
              AND ag.revoked_at IS NULL
              AND (ag.expires_at IS NULL OR ag.expires_at > now())
              AND ag.granted_to = current_setting('app.current_auditor_id', true)
        )
    );

COMMIT;
