// SPDX-License-Identifier: BUSL-1.1
//
// CandidateFindingsRepository — Drizzle path tests.

import { describe, it, expect, beforeEach } from 'vitest';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { RequestContextStore } from '../../common/request-context.js';
import { CandidateFindingsRepository } from './candidate-findings.repository.js';

interface RecordedQuery {
  sql: string;
  params: readonly unknown[];
}

function makeFakeSql(canned: Map<string, unknown[]>) {
  const recorded: RecordedQuery[] = [];

  function tagged(strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]> {
    const sql = strings.join('?').replace(/\s+/g, ' ').trim();
    recorded.push({ sql, params: values });
    for (const [prefix, rows] of canned.entries()) {
      if (sql.startsWith(prefix)) return Promise.resolve(rows);
    }
    return Promise.resolve([]);
  }
  (tagged as unknown as { unsafe: unknown }).unsafe = (sql: string, params: unknown[] = []) => {
    recorded.push({ sql, params });
    return Promise.resolve([]);
  };

  return {
    recorded,
    begin: async <T,>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn(tagged),
  };
}

describe('CandidateFindingsRepository (DB path)', () => {
  const firm = '11111111-1111-1111-1111-111111111111';
  const otherFirm = '22222222-2222-2222-2222-222222222222';
  const auditor = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const eng = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

  let repo: CandidateFindingsRepository;
  let canned: Map<string, unknown[]>;
  let sqlMock: ReturnType<typeof makeFakeSql>;

  beforeEach(() => {
    canned = new Map();
    sqlMock = makeFakeSql(canned);
    repo = new CandidateFindingsRepository(sqlMock as never, new TenancyAdapter());
  });

  function withCtx<T>(fId: string, fn: () => Promise<T>): Promise<T> {
    return RequestContextStore.run(
      { requestId: 'r', firmId: fId, auditorId: auditor, roles: ['lead_auditor'] },
      fn,
    );
  }

  it('lists candidate findings for the engagement and projects payload', async () => {
    canned.set('SELECT * FROM candidate_findings', [
      {
        id: 'cf1',
        firm_id: firm,
        engagement_id: eng,
        status: 'pending',
        rationale: null,
        payload: {
          type: 'major',
          statement: 'No CAPA closure evidence',
          clauses: [{ id: '10.2', label: 'Clause 10.2' }],
          confidence: 'high',
          source: 'engine',
          claimRefs: ['claim-1'],
        },
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
    const out = await withCtx(firm, () => repo.listForEngagement(firm, eng));
    expect(out).toHaveLength(1);
    expect(out[0]?.type).toBe('major');
    expect(out[0]?.confidence).toBe('high');
  });

  it('emits set_tenant_context inside the transaction', async () => {
    canned.set('SELECT * FROM candidate_findings', []);
    await withCtx(firm, () => repo.listForEngagement(firm, eng));
    expect(sqlMock.recorded.some((r) => /set_tenant_context/.test(r.sql))).toBe(true);
  });

  it('isolates by firm', async () => {
    canned.set('SELECT * FROM candidate_findings', []);
    await withCtx(otherFirm, () => repo.listForEngagement(otherFirm, eng));
    const params = sqlMock.recorded.flatMap((r) => r.params).filter((p) => typeof p === 'string');
    expect(params.some((p) => p === otherFirm)).toBe(true);
  });

  it('dismiss updates the row and returns the new status', async () => {
    canned.set('UPDATE candidate_findings', [{ id: 'cf1', status: 'dismissed' }]);
    const out = await withCtx(firm, () => repo.dismiss(firm, 'cf1', 'not material'));
    expect(out.status).toBe('dismissed');
  });

  it('dismiss raises NotFoundError when nothing was returned', async () => {
    canned.set('UPDATE candidate_findings', []);
    await expect(withCtx(firm, () => repo.dismiss(firm, 'missing', 'r'))).rejects.toThrow();
  });
});
