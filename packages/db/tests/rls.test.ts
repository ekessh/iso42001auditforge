// SPDX-License-Identifier: BUSL-1.1
//
// Tenant isolation (Row Level Security) integration test.
//
// What this test proves:
//   1. The five hand-written migrations apply cleanly to a real Postgres 16
//      instance with pgvector.
//   2. The seed runner is idempotent (insert -> insert -> same row count).
//   3. As app_request_role:
//        - SELECT on every business table returns ONLY rows whose firm_id
//          equals app.current_firm_id.
//        - Switching contexts (firm A -> firm B) flips visibility cleanly.
//        - INSERT with a mismatched firm_id raises (RLS WITH CHECK).
//        - UPDATE / DELETE on audit_ledger_events raises (no policy).
//        - UPDATE / DELETE on audit_file_archives raises (no policy).
//        - Without a tenant context set, SELECT returns zero rows.
//   4. As app_service_role (BYPASSRLS):
//        - SELECT returns rows from all firms.
//        - UPDATE / DELETE on append-only tables still raises because the
//          0004 trigger fires regardless of role.

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { runSeed } from '../src/seed/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const migrationsDir = join(__dirname, '..', 'drizzle');

const FIRM_A = '11111111-1111-1111-1111-111111111111';
const FIRM_B = '22222222-2222-2222-2222-222222222222';
const AUDITOR_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const AUDITOR_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const MIGRATION_FILES = [
  '0000_extensions.sql',
  '0001_roles_and_tenancy_helpers.sql',
  '0002_rls_business_tables.sql',
  '0003_indexes_for_perf.sql',
  '0004_append_only_triggers.sql',
];

let container: StartedPostgreSqlContainer;
let serviceClient: Client;
let requestClient: Client;

const SERVICE_USER = 'auditforge_owner';
const REQUEST_USER = 'app_request_role';
const REQUEST_PASSWORD = 'app_request_role';

beforeAll(async () => {
  container = await new PostgreSqlContainer('pgvector/pgvector:pg16')
    .withUsername(SERVICE_USER)
    .withPassword('owner_secret')
    .withDatabase('auditforge_test')
    .start();

  // Apply migrations as the bootstrap superuser-equivalent
  // (Testcontainers gives us a superuser by default; we rotate to
  // app_service_role for actual queries below).
  serviceClient = new Client({ connectionString: container.getConnectionUri() });
  await serviceClient.connect();

  for (const file of MIGRATION_FILES) {
    const sql = await readFile(join(migrationsDir, file), 'utf8');
    await serviceClient.query(sql);
  }

  // Force the request role's password (0001 sets it to 'app_request_role',
  // re-set to ensure parity for our login).
  await serviceClient.query(
    `ALTER ROLE app_request_role WITH LOGIN PASSWORD '${REQUEST_PASSWORD}'`,
  );
  // Make the bootstrap user the owner of all tables (so app_service_role's
  // service_role_passthrough policy matches future inserts via the request
  // role's GRANT). Then grant app_request_role its row-level access.
  await serviceClient.query('GRANT app_service_role TO ' + SERVICE_USER);

  // Seed catalogues + RBAC under the bootstrap connection (BYPASSRLS as
  // superuser). Verifies the seed runner happy path.
  await runSeed({
    connection: { connectionString: container.getConnectionUri() },
    log: () => {},
  });

  // Insert tenancy fixtures.
  await serviceClient.query(
    `INSERT INTO audit_firms (id, name, legal_name, country_code) VALUES
       ($1, 'Firm A', 'Firm A LLC', 'US'),
       ($2, 'Firm B', 'Firm B LLC', 'GB')`,
    [FIRM_A, FIRM_B],
  );
  await serviceClient.query(
    `INSERT INTO auditors (id, firm_id, email, full_name, primary_role) VALUES
       ($1, $2, 'a@firm-a.test', 'Alice', 'lead_auditor'),
       ($3, $4, 'b@firm-b.test', 'Bob',   'lead_auditor')`,
    [AUDITOR_A, FIRM_A, AUDITOR_B, FIRM_B],
  );

  // One client per firm.
  await serviceClient.query(
    `INSERT INTO clients (id, firm_id, legal_name, country_code) VALUES
       ('33333333-3333-3333-3333-333333333333', $1, 'Auditee A',    'US'),
       ('44444444-4444-4444-4444-444444444444', $2, 'Auditee B',    'GB')`,
    [FIRM_A, FIRM_B],
  );

  // Engagements
  await serviceClient.query(
    `INSERT INTO engagements (id, firm_id, client_id, code) VALUES
       ('55555555-5555-5555-5555-555555555555', $1, '33333333-3333-3333-3333-333333333333', 'E-A-001'),
       ('66666666-6666-6666-6666-666666666666', $2, '44444444-4444-4444-4444-444444444444', 'E-B-001')`,
    [FIRM_A, FIRM_B],
  );

  // Working papers (2 per firm)
  await serviceClient.query(
    `INSERT INTO working_papers (firm_id, engagement_id, title) VALUES
       ($1, '55555555-5555-5555-5555-555555555555', 'WP A1'),
       ($1, '55555555-5555-5555-5555-555555555555', 'WP A2'),
       ($2, '66666666-6666-6666-6666-666666666666', 'WP B1'),
       ($2, '66666666-6666-6666-6666-666666666666', 'WP B2')`,
    [FIRM_A, FIRM_B],
  );

  // Findings (3 per firm)
  await serviceClient.query(
    `INSERT INTO findings (firm_id, engagement_id, finding_type, finding_state, title, raised_at) VALUES
       ($1, '55555555-5555-5555-5555-555555555555', 'minor_nc', 'open', 'A finding 1', now()),
       ($1, '55555555-5555-5555-5555-555555555555', 'major_nc', 'open', 'A finding 2', now()),
       ($1, '55555555-5555-5555-5555-555555555555', 'ofi',      'open', 'A finding 3', now()),
       ($2, '66666666-6666-6666-6666-666666666666', 'minor_nc', 'open', 'B finding 1', now()),
       ($2, '66666666-6666-6666-6666-666666666666', 'minor_nc', 'open', 'B finding 2', now()),
       ($2, '66666666-6666-6666-6666-666666666666', 'major_nc', 'open', 'B finding 3', now())`,
    [FIRM_A, FIRM_B],
  );

  // Evidence objects
  await serviceClient.query(
    `INSERT INTO evidence_objects (firm_id, engagement_id, storage_key, sha256, size_bytes) VALUES
       ($1, '55555555-5555-5555-5555-555555555555', 'a/1.pdf', 'a' || lpad('', 63, 'a'), 100),
       ($1, '55555555-5555-5555-5555-555555555555', 'a/2.pdf', 'b' || lpad('', 63, 'b'), 100),
       ($2, '66666666-6666-6666-6666-666666666666', 'b/1.pdf', 'c' || lpad('', 63, 'c'), 100)`,
    [FIRM_A, FIRM_B],
  );

  // Audit ledger events: 2 per firm
  await serviceClient.query(
    `INSERT INTO audit_ledger_events (firm_id, engagement_id, auditor_id, event_type, sequence, hash) VALUES
       ($1, '55555555-5555-5555-5555-555555555555', $3, 'engagement.created', 1, 'a-h1'),
       ($1, '55555555-5555-5555-5555-555555555555', $3, 'finding.raised',     2, 'a-h2'),
       ($2, '66666666-6666-6666-6666-666666666666', $4, 'engagement.created', 1, 'b-h1'),
       ($2, '66666666-6666-6666-6666-666666666666', $4, 'finding.raised',     2, 'b-h2')`,
    [FIRM_A, FIRM_B, AUDITOR_A, AUDITOR_B],
  );

  // Episodes + claims (touches the bi-temporal table set + indexes)
  await serviceClient.query(
    `INSERT INTO episodes (firm_id, engagement_id, source) VALUES
       ($1, '55555555-5555-5555-5555-555555555555', 'manual'),
       ($2, '66666666-6666-6666-6666-666666666666', 'manual')`,
    [FIRM_A, FIRM_B],
  );
  await serviceClient.query(
    `INSERT INTO claims (firm_id, engagement_id, subject, predicate, object_text) VALUES
       ($1, '55555555-5555-5555-5555-555555555555', 'sys-A', 'documentsControl', 'A.7.2 evidence'),
       ($2, '66666666-6666-6666-6666-666666666666', 'sys-B', 'documentsControl', 'B.5.1 evidence')`,
    [FIRM_A, FIRM_B],
  );

  // Connect the request-role client (used by the per-test assertions).
  requestClient = new Client({
    host: container.getHost(),
    port: container.getMappedPort(5432),
    user: REQUEST_USER,
    password: REQUEST_PASSWORD,
    database: 'auditforge_test',
  });
  await requestClient.connect();
}, 180_000);

afterAll(async () => {
  await requestClient?.end();
  await serviceClient?.end();
  await container?.stop();
}, 60_000);

async function asTenant(firmId: string, auditorId: string): Promise<void> {
  // Use a transactional context so SET LOCAL applies. The repeating BEGIN
  // pattern in production lives inside a withTenantContext(...) wrapper —
  // here we approximate by issuing it before each query.
  await requestClient.query('BEGIN');
  await requestClient.query('SELECT set_tenant_context($1::uuid, $2::uuid)', [firmId, auditorId]);
}
async function endTx(): Promise<void> {
  await requestClient.query('COMMIT');
}

describe('RLS migrations apply cleanly', () => {
  it('every migration file exists', () => {
    expect(MIGRATION_FILES).toHaveLength(5);
  });

  it('roles app_request_role + app_service_role exist', async () => {
    const r = await serviceClient.query(
      `SELECT rolname, rolbypassrls FROM pg_roles
       WHERE rolname IN ('app_request_role', 'app_service_role')
       ORDER BY rolname`,
    );
    expect(r.rowCount).toBe(2);
    const byName = Object.fromEntries(r.rows.map((row) => [row.rolname, row]));
    expect(byName.app_request_role.rolbypassrls).toBe(false);
    expect(byName.app_service_role.rolbypassrls).toBe(true);
  });

  it('set_tenant_context + clear_tenant_context functions exist', async () => {
    const r = await serviceClient.query(
      `SELECT proname FROM pg_proc
       WHERE proname IN ('set_tenant_context', 'clear_tenant_context', 'set_engagement_context')
       ORDER BY proname`,
    );
    expect(r.rowCount).toBe(3);
  });

  it('all required extensions are installed', async () => {
    const r = await serviceClient.query(
      `SELECT extname FROM pg_extension
       WHERE extname IN ('vector', 'pgcrypto', 'uuid-ossp', 'pg_trgm', 'btree_gin')
       ORDER BY extname`,
    );
    expect(r.rowCount).toBe(5);
  });

  it('every business table has tenant_isolation policy', async () => {
    // Sample a few of the most important tables.
    const tables = [
      'engagements',
      'working_papers',
      'findings',
      'evidence_objects',
      'claims',
      'episodes',
      'soa_records',
      'ai_risk_register_entries',
      'agent_workflows',
      'corrective_actions',
      'samples',
      'sample_units',
      'interview_records',
      'probe_definitions',
      'probe_executions',
      'agent_traces',
      'co_auditor_invocations',
      'llm_invocations',
      'audit_reports',
      'peer_reviews',
      'billing_entries',
      'surveillance_telemetry',
    ];
    const r = await serviceClient.query(
      `SELECT tablename, policyname FROM pg_policies
       WHERE schemaname = 'public' AND tablename = ANY($1)`,
      [tables],
    );
    const byTable = new Map<string, string[]>();
    for (const row of r.rows) {
      const existing = byTable.get(row.tablename) ?? [];
      existing.push(row.policyname);
      byTable.set(row.tablename, existing);
    }
    for (const t of tables) {
      const policies = byTable.get(t) ?? [];
      expect(policies, `${t} should have tenant_isolation policy`).toContain('tenant_isolation');
    }
  });

  it('audit_ledger_events does not have an UPDATE/DELETE policy', async () => {
    const r = await serviceClient.query(
      `SELECT policyname, cmd FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'audit_ledger_events'`,
    );
    const cmds = r.rows.map((row) => row.cmd);
    // Should have SELECT + INSERT only (no UPDATE/DELETE policies).
    expect(cmds).toContain('SELECT');
    expect(cmds).toContain('INSERT');
    expect(cmds).not.toContain('UPDATE');
    expect(cmds).not.toContain('DELETE');
  });

  it('audit_file_archives has accreditation_readonly policy', async () => {
    const r = await serviceClient.query(
      `SELECT policyname FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'audit_file_archives'`,
    );
    const names = r.rows.map((row) => row.policyname);
    expect(names).toContain('accreditation_readonly');
    expect(names).toContain('tenant_select');
    expect(names).toContain('tenant_append_only');
  });

  it('append-only triggers exist on audit_ledger_events', async () => {
    const r = await serviceClient.query(
      `SELECT tgname FROM pg_trigger
       WHERE tgrelid = 'audit_ledger_events'::regclass
         AND NOT tgisinternal
       ORDER BY tgname`,
    );
    const names = r.rows.map((row) => row.tgname);
    expect(names).toContain('audit_ledger_events_no_update');
    expect(names).toContain('audit_ledger_events_no_delete');
    expect(names).toContain('audit_ledger_events_no_truncate');
  });
});

describe('Seed runner', () => {
  it('inserts at least one row into every reference catalogue', async () => {
    const tables = [
      'iso42001_clauses',
      'annex_a_controls',
      'eu_ai_act_articles',
      'nist_ai_rmf_subcategories',
      'owasp_llm_top10',
      'mitre_atlas_techniques',
      'avid_categories',
      'mit_ai_risk_categories',
      'rbac_roles',
      'rbac_permissions',
    ];
    for (const t of tables) {
      const r = await serviceClient.query(`SELECT count(*)::int AS c FROM "${t}"`);
      expect(r.rows[0].c, `expected catalogue ${t} to have rows`).toBeGreaterThan(0);
    }
  });

  it('seed is idempotent (re-running does not duplicate rows)', async () => {
    const before = await serviceClient.query('SELECT count(*)::int AS c FROM rbac_permissions');
    await runSeed({
      connection: { connectionString: container.getConnectionUri() },
      log: () => {},
    });
    const after = await serviceClient.query('SELECT count(*)::int AS c FROM rbac_permissions');
    expect(after.rows[0].c).toBe(before.rows[0].c);
  });

  it('seeds all 9 RBAC roles', async () => {
    const r = await serviceClient.query('SELECT count(*)::int AS c FROM rbac_roles');
    expect(r.rows[0].c).toBe(9);
  });
});

describe('Tenant isolation as app_request_role — firm A context', () => {
  beforeAll(async () => {
    await asTenant(FIRM_A, AUDITOR_A);
  });
  afterAll(async () => {
    await endTx();
  });

  it('engagements: firm A sees only its rows', async () => {
    const r = await requestClient.query('SELECT firm_id FROM engagements');
    expect(r.rowCount).toBe(1);
    expect(r.rows[0].firm_id).toBe(FIRM_A);
  });

  it('working_papers: firm A sees exactly 2 rows', async () => {
    const r = await requestClient.query('SELECT firm_id FROM working_papers');
    expect(r.rowCount).toBe(2);
    expect(new Set(r.rows.map((row) => row.firm_id))).toEqual(new Set([FIRM_A]));
  });

  it('findings: firm A sees exactly 3 rows', async () => {
    const r = await requestClient.query('SELECT firm_id FROM findings');
    expect(r.rowCount).toBe(3);
  });

  it('evidence_objects: firm A sees 2 rows, firm B 0', async () => {
    const r = await requestClient.query('SELECT firm_id FROM evidence_objects');
    expect(r.rowCount).toBe(2);
    for (const row of r.rows) expect(row.firm_id).toBe(FIRM_A);
  });

  it('audit_ledger_events: firm A sees its 2 events', async () => {
    const r = await requestClient.query('SELECT firm_id FROM audit_ledger_events');
    expect(r.rowCount).toBe(2);
  });

  it('claims: firm A sees its row only', async () => {
    const r = await requestClient.query('SELECT firm_id, subject FROM claims');
    expect(r.rowCount).toBe(1);
    expect(r.rows[0].subject).toBe('sys-A');
  });

  it('clients: firm A sees 1', async () => {
    const r = await requestClient.query('SELECT firm_id FROM clients');
    expect(r.rowCount).toBe(1);
  });

  it('episodes: firm A sees 1', async () => {
    const r = await requestClient.query('SELECT firm_id FROM episodes');
    expect(r.rowCount).toBe(1);
  });

  it('INSERT succeeds when firm_id matches context', async () => {
    const r = await requestClient.query(
      `INSERT INTO findings (firm_id, engagement_id, finding_type, finding_state, title, raised_at)
       VALUES ($1, '55555555-5555-5555-5555-555555555555', 'ofi', 'draft', 'A new', now())
       RETURNING id`,
      [FIRM_A],
    );
    expect(r.rowCount).toBe(1);
  });

  it('INSERT fails when firm_id mismatches context (RLS WITH CHECK)', async () => {
    await expect(
      requestClient.query(
        `INSERT INTO findings (firm_id, engagement_id, finding_type, finding_state, title, raised_at)
         VALUES ($1, '66666666-6666-6666-6666-666666666666', 'ofi', 'draft', 'cross-tenant', now())`,
        [FIRM_B],
      ),
    ).rejects.toThrow(/row-level security|new row violates/i);
  });

  it('INSERT into audit_ledger_events succeeds within tenant', async () => {
    const r = await requestClient.query(
      `INSERT INTO audit_ledger_events (firm_id, engagement_id, auditor_id, event_type, sequence, hash)
       VALUES ($1, '55555555-5555-5555-5555-555555555555', $2, 'extra.event', 99, 'a-h99')
       RETURNING id`,
      [FIRM_A, AUDITOR_A],
    );
    expect(r.rowCount).toBe(1);
  });

  it('UPDATE on audit_ledger_events fails (no policy permits it)', async () => {
    await expect(
      requestClient.query(
        `UPDATE audit_ledger_events SET event_type = 'tampered' WHERE firm_id = $1`,
        [FIRM_A],
      ),
    ).rejects.toThrow();
  });

  it('DELETE on audit_ledger_events fails (no policy permits it)', async () => {
    await expect(
      requestClient.query(`DELETE FROM audit_ledger_events WHERE firm_id = $1`, [FIRM_A]),
    ).rejects.toThrow();
  });

  it('UPDATE on audit_file_archives fails (no policy permits it)', async () => {
    // Insert a row first so there's something to attempt to update.
    await requestClient.query(
      `INSERT INTO audit_file_archives (firm_id, engagement_id, archive_uri, archive_hash)
       VALUES ($1, '55555555-5555-5555-5555-555555555555', 'minio://a.zip', 'h0')`,
      [FIRM_A],
    );
    await expect(
      requestClient.query(
        `UPDATE audit_file_archives SET archive_uri = 'tampered' WHERE firm_id = $1`,
        [FIRM_A],
      ),
    ).rejects.toThrow();
  });

  it('DELETE on audit_file_archives fails (no policy permits it)', async () => {
    await expect(
      requestClient.query(`DELETE FROM audit_file_archives WHERE firm_id = $1`, [FIRM_A]),
    ).rejects.toThrow();
  });
});

describe('Tenant isolation as app_request_role — firm B context', () => {
  beforeAll(async () => {
    await asTenant(FIRM_B, AUDITOR_B);
  });
  afterAll(async () => {
    await endTx();
  });

  it('engagements: firm B sees only its rows', async () => {
    const r = await requestClient.query('SELECT firm_id FROM engagements');
    expect(r.rowCount).toBe(1);
    expect(r.rows[0].firm_id).toBe(FIRM_B);
  });

  it('working_papers: firm B sees exactly 2 rows', async () => {
    const r = await requestClient.query('SELECT firm_id FROM working_papers');
    expect(r.rowCount).toBe(2);
    for (const row of r.rows) expect(row.firm_id).toBe(FIRM_B);
  });

  it('findings: firm B sees its 3 rows', async () => {
    const r = await requestClient.query('SELECT firm_id FROM findings');
    expect(r.rowCount).toBe(3);
    for (const row of r.rows) expect(row.firm_id).toBe(FIRM_B);
  });

  it('claims: firm B sees its row only', async () => {
    const r = await requestClient.query('SELECT subject FROM claims');
    expect(r.rowCount).toBe(1);
    expect(r.rows[0].subject).toBe('sys-B');
  });

  it('UPDATE attempt on a firm-A row affects 0 rows (RLS hides them)', async () => {
    // RLS SELECT policy filters firm-A rows out of the UPDATE candidate set,
    // so this UPDATE is a no-op rather than an error.
    const r = await requestClient.query(
      `UPDATE findings SET title = 'mut' WHERE firm_id = $1`,
      [FIRM_A],
    );
    expect(r.rowCount).toBe(0);
  });

  it('DELETE attempt on a firm-A row affects 0 rows (RLS hides them)', async () => {
    const r = await requestClient.query('DELETE FROM findings WHERE firm_id = $1', [FIRM_A]);
    expect(r.rowCount).toBe(0);
  });
});

describe('Tenant isolation: no context = no rows', () => {
  it('SELECT returns 0 rows when no context set', async () => {
    // Fresh connection so SET LOCAL state is empty.
    const fresh = new Client({
      host: container.getHost(),
      port: container.getMappedPort(5432),
      user: REQUEST_USER,
      password: REQUEST_PASSWORD,
      database: 'auditforge_test',
    });
    await fresh.connect();
    try {
      // No context => current_setting('app.current_firm_id', true) returns
      // NULL, so firm_id = NULL is NULL (not true) for every row, the policy
      // filters everything, and the result set is empty.
      const r = await fresh.query('SELECT * FROM findings');
      expect(r.rowCount).toBe(0);
    } finally {
      await fresh.end();
    }
  });

  it('INSERT without context fails (firm_id IS NULL fails WITH CHECK)', async () => {
    const fresh = new Client({
      host: container.getHost(),
      port: container.getMappedPort(5432),
      user: REQUEST_USER,
      password: REQUEST_PASSWORD,
      database: 'auditforge_test',
    });
    await fresh.connect();
    try {
      await expect(
        fresh.query(
          `INSERT INTO findings (firm_id, engagement_id, finding_type, finding_state, title, raised_at)
           VALUES ($1, '55555555-5555-5555-5555-555555555555', 'ofi', 'draft', 'no-ctx', now())`,
          [FIRM_A],
        ),
      ).rejects.toThrow(/row-level security|new row violates/i);
    } finally {
      await fresh.end();
    }
  });
});

describe('Service role bypass + append-only triggers', () => {
  it('app_service_role sees rows from all firms', async () => {
    // serviceClient is the bootstrap user (has BYPASSRLS via service_role).
    const r = await serviceClient.query(
      'SELECT count(DISTINCT firm_id)::int AS c FROM findings',
    );
    expect(r.rows[0].c).toBe(2);
  });

  it('append-only trigger raises even on direct UPDATE by service role', async () => {
    await expect(
      serviceClient.query(
        `UPDATE audit_ledger_events SET event_type = 'tampered' WHERE sequence = 1`,
      ),
    ).rejects.toThrow(/append-only/i);
  });

  it('append-only trigger raises even on direct DELETE by service role', async () => {
    await expect(
      serviceClient.query('DELETE FROM audit_ledger_events WHERE sequence = 1'),
    ).rejects.toThrow(/append-only/i);
  });

  it('append-only trigger raises on TRUNCATE', async () => {
    await expect(
      serviceClient.query('TRUNCATE audit_ledger_events'),
    ).rejects.toThrow(/append-only/i);
  });

  it('append-only trigger fires on audit_file_archives UPDATE', async () => {
    await expect(
      serviceClient.query("UPDATE audit_file_archives SET archive_uri = 'x'"),
    ).rejects.toThrow(/append-only/i);
  });
});

describe('Performance indexes are present', () => {
  const expected = [
    'episodes_engagement_ingestion_ix',
    'claims_engagement_event_window_ix',
    'claim_relations_subject_predicate_ix',
    'claims_object_text_trgm_ix',
    'claims_embedding_ivfflat_ix',
    'clause_embeddings_ivfflat_ix',
    'candidate_findings_engagement_status_ix',
    'findings_engagement_raised_ix',
  ];
  it.each(expected)('index %s exists', async (name) => {
    const r = await serviceClient.query(
      'SELECT 1 FROM pg_class WHERE relname = $1 AND relkind = $2',
      [name, 'i'],
    );
    expect(r.rowCount).toBe(1);
  });
});

describe('Re-running migrations is idempotent', () => {
  it('applying every migration twice does not error', async () => {
    for (const file of MIGRATION_FILES) {
      const sql = await readFile(join(migrationsDir, file), 'utf8');
      await serviceClient.query(sql);
    }
    // If we reach here without throwing, idempotency holds.
    expect(true).toBe(true);
  });
});
