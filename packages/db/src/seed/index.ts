// SPDX-License-Identifier: BUSL-1.1
//
// Idempotent seed runner.
//
// - Connects as app_service_role (BYPASSRLS).
// - Loads reference catalogues from @auditforge/catalogues and inserts each
//   row with ON CONFLICT DO NOTHING. Re-runs are no-ops.
// - Loads the RBAC role + permission matrix from @auditforge/auth-core and
//   inserts roles + per-(role, resource, action) scope rows.
// - All work runs inside a single transaction so partial failures roll back.
//
// Usage:
//   DATABASE_URL=postgres://app_service_role:app_service_role@host/db \
//     pnpm --filter @auditforge/db seed
//
// The runner is also imported directly by tests/rls.test.ts so they exercise
// the same code path that production uses.

import {
  loadAllCatalogues,
  type AllCatalogues,
  type AvidCategoryRef,
  type MitAiRiskCategoryRef,
} from '@auditforge/catalogues';
import { ROLES, buildFullPermissionMatrix } from '@auditforge/auth-core';
import { Client, type ClientConfig } from 'pg';

export interface SeedOptions {
  /** Postgres connection. Falls back to DATABASE_URL env var. */
  readonly connection?: ClientConfig | string;
  /** Optional pre-loaded catalogues (used by tests to skip disk IO). */
  readonly catalogues?: AllCatalogues;
  /** Optional logger; defaults to console.log. */
  readonly log?: (msg: string) => void;
}

export interface SeedResult {
  readonly clauses: number;
  readonly annexAControls: number;
  readonly euAiActArticles: number;
  readonly nistSubcategories: number;
  readonly owaspRisks: number;
  readonly mitreTechniques: number;
  readonly avidCategories: number;
  readonly avidSubcategories: number;
  readonly mitAiRiskCategories: number;
  readonly mitAiRiskSubcategories: number;
  readonly frameworkMappings: number;
  readonly rbacRoles: number;
  readonly rbacPermissions: number;
}

const ROLE_DESCRIPTIONS: Record<(typeof ROLES)[number], string> = {
  super_admin: 'Cross-firm administrator (platform staff).',
  firm_admin: 'Administrator within a single audit firm.',
  lead_auditor: 'Lead auditor signing engagements.',
  team_auditor: 'Audit team member contributing working papers.',
  technical_expert: 'Domain expert co-auditing AI systems.',
  audit_manager: 'Manages auditor competence and impartiality.',
  peer_reviewer: 'Independent review of completed engagements.',
  client_user: 'Auditee personnel uploading evidence + responding to CAPA.',
  accreditation_auditor: 'Read-only role for accreditation bodies.',
};

export async function runSeed(opts: SeedOptions = {}): Promise<SeedResult> {
  const log = opts.log ?? ((m) => console.log(`[seed] ${m}`));
  const cfg: ClientConfig | string =
    opts.connection ??
    process.env.DATABASE_URL ??
    'postgres://app_service_role:app_service_role@localhost:5432/auditforge';

  const client = typeof cfg === 'string' ? new Client({ connectionString: cfg }) : new Client(cfg);
  await client.connect();
  try {
    const catalogues = opts.catalogues ?? (await loadAllCatalogues());

    await client.query('BEGIN');
    const result = await seedAll(client, catalogues, log);
    await client.query('COMMIT');
    log(`seed complete: ${JSON.stringify(result)}`);
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback failure
    }
    throw err;
  } finally {
    await client.end();
  }
}

async function seedAll(
  client: Client,
  catalogues: AllCatalogues,
  log: (msg: string) => void,
): Promise<SeedResult> {
  // ---- Catalogues ------------------------------------------------------

  const clauses = await insertManyJson(client, 'iso42001_clauses', catalogues.iso42001Clauses, [
    'id',
    'title',
  ]);
  log(`iso42001_clauses: ${clauses} rows`);

  const annexA = await insertManyJson(client, 'annex_a_controls', catalogues.annexAControls, [
    'id',
    'title',
    'category',
  ]);
  log(`annex_a_controls: ${annexA} rows`);

  const euArticles = await insertManyJson(
    client,
    'eu_ai_act_articles',
    catalogues.euAiActArticles.map((r) => ({ id: r.id, title: r.title, risk_tier: r.riskTier })),
    ['id', 'title', 'risk_tier'],
  );
  log(`eu_ai_act_articles: ${euArticles} rows`);

  const nistSub = await insertManyJson(
    client,
    'nist_ai_rmf_subcategories',
    catalogues.nistAiRmfSubcategories.map((r) => ({
      id: r.id,
      function: r.function,
      title: r.title,
    })),
    ['id', 'function', 'title'],
  );
  log(`nist_ai_rmf_subcategories: ${nistSub} rows`);

  const owasp = await insertManyJson(client, 'owasp_llm_top10', catalogues.owaspLlmTop10, [
    'id',
    'title',
  ]);
  log(`owasp_llm_top10: ${owasp} rows`);

  const mitre = await insertManyJson(
    client,
    'mitre_atlas_techniques',
    catalogues.mitreAtlasTechniques.map((r) => ({ id: r.id, tactic: r.tactic, title: r.title })),
    ['id', 'tactic', 'title'],
  );
  log(`mitre_atlas_techniques: ${mitre} rows`);

  // AVID has nested subcategories
  const avidCats = catalogues.avidCategories;
  const avidCatRows = await insertManyJson(
    client,
    'avid_categories',
    avidCats.map((c: AvidCategoryRef) => ({ id: c.id, title: c.title })),
    ['id', 'title'],
  );
  const avidSubRows = await insertManyJson(
    client,
    'avid_subcategories',
    avidCats.flatMap((c: AvidCategoryRef) =>
      c.subcategories.map((s) => ({ id: s.id, category_id: c.id, title: s.title })),
    ),
    ['id', 'category_id', 'title'],
  );
  log(`avid_categories: ${avidCatRows} rows / avid_subcategories: ${avidSubRows} rows`);

  const mitCats = catalogues.mitAiRiskCategories;
  const mitCatRows = await insertManyJson(
    client,
    'mit_ai_risk_categories',
    mitCats.map((c: MitAiRiskCategoryRef) => ({ id: c.id, title: c.title })),
    ['id', 'title'],
  );
  const mitSubRows = await insertManyJson(
    client,
    'mit_ai_risk_subcategories',
    mitCats.flatMap((c: MitAiRiskCategoryRef) =>
      c.subcategories.map((s) => ({ id: s.id, category_id: c.id, title: s.title })),
    ),
    ['id', 'category_id', 'title'],
  );
  log(`mit_ai_risk_categories: ${mitCatRows} / mit_ai_risk_subcategories: ${mitSubRows} rows`);

  const mappings = await insertManyJson(
    client,
    'framework_mappings',
    catalogues.frameworkMappings.map((m) => ({
      from_framework: m.from.framework,
      from_node_id: m.from.id,
      to_framework: m.to.framework,
      to_node_id: m.to.id,
      strength: m.strength,
      rationale: m.rationale,
      confidence: m.confidence,
    })),
    ['from_framework', 'from_node_id', 'to_framework', 'to_node_id', 'strength', 'rationale', 'confidence'],
    /* conflictColumns */ ['from_framework', 'from_node_id', 'to_framework', 'to_node_id'],
  );
  log(`framework_mappings: ${mappings} rows`);

  // ---- RBAC ------------------------------------------------------------

  const roleRows = await insertManyJson(
    client,
    'rbac_roles',
    ROLES.map((r) => ({ role: r, description: ROLE_DESCRIPTIONS[r] })),
    ['role', 'description'],
    ['role'],
  );
  log(`rbac_roles: ${roleRows} rows`);

  // Only persist permissions whose scope is not 'none'.
  const matrix = buildFullPermissionMatrix().filter((p) => p.scope !== 'none');
  const permRows = await insertManyJson(
    client,
    'rbac_permissions',
    matrix.map((p) => ({
      role: p.role,
      resource: p.resource,
      action: p.action,
      scope: p.scope,
    })),
    ['role', 'resource', 'action', 'scope'],
    ['role', 'resource', 'action'],
  );
  log(`rbac_permissions: ${permRows} rows`);

  return {
    clauses,
    annexAControls: annexA,
    euAiActArticles: euArticles,
    nistSubcategories: nistSub,
    owaspRisks: owasp,
    mitreTechniques: mitre,
    avidCategories: avidCatRows,
    avidSubcategories: avidSubRows,
    mitAiRiskCategories: mitCatRows,
    mitAiRiskSubcategories: mitSubRows,
    frameworkMappings: mappings,
    rbacRoles: roleRows,
    rbacPermissions: permRows,
  };
}

async function insertManyJson(
  client: Client,
  table: string,
  rows: ReadonlyArray<Record<string, unknown>>,
  columns: ReadonlyArray<string>,
  conflictColumns?: ReadonlyArray<string>,
): Promise<number> {
  if (rows.length === 0) return 0;
  const colList = columns.map(quoteIdent).join(', ');
  const conflictTarget =
    conflictColumns && conflictColumns.length > 0
      ? `(${conflictColumns.map(quoteIdent).join(', ')})`
      : `(${quoteIdent(columns[0]!)})`;

  let inserted = 0;
  // Batch in groups of 200 so we don't blow the bind parameter limit.
  const batchSize = 200;
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    const params: unknown[] = [];
    const valueRows: string[] = [];
    for (const row of batch) {
      const placeholders = columns.map((c) => {
        params.push(row[c]);
        return `$${params.length}`;
      });
      valueRows.push(`(${placeholders.join(', ')})`);
    }
    const sql = `INSERT INTO ${quoteIdent(table)} (${colList})
                 VALUES ${valueRows.join(', ')}
                 ON CONFLICT ${conflictTarget} DO NOTHING`;
    const res = await client.query(sql, params);
    inserted += res.rowCount ?? 0;
  }
  return inserted;
}

function quoteIdent(name: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`unsafe identifier: ${name}`);
  }
  return `"${name}"`;
}

// CLI entry point: only run when invoked directly via tsx.
const isCli = (() => {
  try {
    const argv1 = process.argv[1];
    if (!argv1) return false;
    return argv1.endsWith('seed/index.ts') || argv1.endsWith('seed\\index.ts');
  } catch {
    return false;
  }
})();

if (isCli) {
  runSeed().catch((err) => {
    console.error('[seed] fatal', err);
    process.exit(1);
  });
}
