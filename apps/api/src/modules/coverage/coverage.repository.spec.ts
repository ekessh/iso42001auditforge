// SPDX-License-Identifier: BUSL-1.1

import { describe, it, expect, beforeEach } from 'vitest';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { RequestContextStore } from '../../common/request-context.js';
import {
  CoverageRepository,
  computeOverallReadiness,
} from './coverage.repository.js';

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

describe('CoverageRepository (DB path)', () => {
  const firm = '11111111-1111-1111-1111-111111111111';
  const auditor = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const eng = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

  let repo: CoverageRepository;
  let canned: Map<string, unknown[]>;
  let sqlMock: ReturnType<typeof makeFakeSql>;

  beforeEach(() => {
    canned = new Map();
    sqlMock = makeFakeSql(canned);
    repo = new CoverageRepository(sqlMock as never, new TenancyAdapter());
  });

  function withCtx<T>(fn: () => Promise<T>): Promise<T> {
    return RequestContextStore.run(
      { requestId: 'r', firmId: firm, auditorId: auditor, roles: ['lead_auditor'] },
      fn,
    );
  }

  it('returns coverage for an engagement, defaulting to fallback clauses when catalogue is empty', async () => {
    canned.set('SELECT id, title FROM iso42001_clauses', []);
    canned.set('SELECT body FROM working_papers', []);
    const area = await withCtx(() => repo.getCoverage(firm, eng));
    expect(area.id).toBe('iso42001');
    expect(area.cells.length).toBeGreaterThan(0);
    expect(area.cells.every((c) => c.status === 'untouched')).toBe(true);
  });

  it('emits set_tenant_context when computing coverage (RLS)', async () => {
    canned.set('SELECT id, title FROM iso42001_clauses', []);
    canned.set('SELECT body FROM working_papers', []);
    await withCtx(() => repo.getCoverage(firm, eng));
    expect(sqlMock.recorded.some((r) => /set_tenant_context/.test(r.sql))).toBe(true);
  });

  it('promotes a clause to evidenced when a final working paper references its controlRef', async () => {
    canned.set('SELECT id, title FROM iso42001_clauses', [
      { id: '6', title: 'Planning' },
      { id: '7', title: 'Support' },
    ]);
    canned.set('SELECT body FROM working_papers', [
      { body: { __af: { controlRef: '6', status: 'final' } } },
    ]);
    const area = await withCtx(() => repo.getCoverage(firm, eng));
    expect(area.cells.find((c) => c.id === '6')?.status).toBe('evidenced');
    expect(area.cells.find((c) => c.id === '7')?.status).toBe('untouched');
  });
});

describe('computeOverallReadiness', () => {
  it('weights mandatory clauses 1.5x', () => {
    const out = computeOverallReadiness({
      id: 'x',
      title: 'x',
      cells: [
        { id: '6', status: 'evidenced' },
        { id: 'A.6.2', status: 'untouched' },
      ],
    });
    expect(out.pct).toBeCloseTo((1.5 * 1.0 + 1.0 * 0.0) / (1.5 + 1.0) * 100);
  });

  it('returns 0 when there are no clauses', () => {
    const out = computeOverallReadiness({ id: 'x', title: 'x', cells: [] });
    expect(out.pct).toBe(0);
  });
});
