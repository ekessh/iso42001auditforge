// SPDX-License-Identifier: BUSL-1.1

import { describe, it, expect, beforeEach } from 'vitest';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { RequestContextStore } from '../../common/request-context.js';
import { LibraryRepository } from './library.repository.js';

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

describe('LibraryRepository', () => {
  const firm = '11111111-1111-1111-1111-111111111111';
  const auditor = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  let repo: LibraryRepository;
  let canned: Map<string, unknown[]>;
  let sqlMock: ReturnType<typeof makeFakeSql>;

  beforeEach(() => {
    canned = new Map();
    sqlMock = makeFakeSql(canned);
    repo = new LibraryRepository(sqlMock as never, new TenancyAdapter());
  });

  function withCtx<T>(fn: () => Promise<T>): Promise<T> {
    return RequestContextStore.run(
      { requestId: 'r', firmId: firm, auditorId: auditor, roles: ['lead_auditor'] },
      fn,
    );
  }

  it('returns iso42001 clauses when kind=clause', async () => {
    canned.set('SELECT id, title, metadata FROM iso42001_clauses', [
      { id: '6', title: 'Planning' },
      { id: '7', title: 'Support' },
    ]);
    const out = await withCtx(() => repo.list({ kind: 'clause', limit: 50 }));
    expect(out.items).toHaveLength(2);
    expect(out.items[0]?.kind).toBe('iso42001_clause');
  });

  it('emits set_tenant_context inside the transaction (RLS)', async () => {
    canned.set('SELECT id, title, metadata FROM iso42001_clauses', []);
    await withCtx(() => repo.list({ kind: 'clause', limit: 50 }));
    expect(sqlMock.recorded.some((r) => /set_tenant_context/.test(r.sql))).toBe(true);
  });

  it('applies the q filter via ILIKE pattern', async () => {
    canned.set('SELECT id, title, metadata FROM iso42001_clauses', []);
    await withCtx(() => repo.list({ kind: 'clause', q: 'plan', limit: 50 }));
    const params = sqlMock.recorded.flatMap((r) => r.params).filter((p) => typeof p === 'string');
    expect(params.some((p) => (p as string).includes('plan'))).toBe(true);
  });

  it('control-mapping kind alias resolves to annex_a_controls', async () => {
    canned.set('SELECT id, title, metadata FROM annex_a_controls', [
      { id: 'A.6.2', title: 'AI system policy' },
    ]);
    const out = await withCtx(() => repo.list({ kind: 'control-mapping', limit: 50 }));
    expect(out.items[0]?.kind).toBe('annex_a_control');
  });
});
