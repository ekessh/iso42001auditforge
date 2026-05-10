// SPDX-License-Identifier: BUSL-1.1
//
// TracesRepository — Drizzle path tests.
// Mirrors the harness from clients.repository.spec.ts.

import { describe, it, expect, beforeEach } from 'vitest';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { RequestContextStore } from '../../common/request-context.js';
import { TracesRepository } from './traces.repository.js';

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

describe('TracesRepository (DB path)', () => {
  const firm = '11111111-1111-1111-1111-111111111111';
  const otherFirm = '22222222-2222-2222-2222-222222222222';
  const auditor = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  let repo: TracesRepository;
  let canned: Map<string, unknown[]>;
  let sqlMock: ReturnType<typeof makeFakeSql>;

  beforeEach(() => {
    canned = new Map();
    sqlMock = makeFakeSql(canned);
    repo = new TracesRepository(sqlMock as never, new TenancyAdapter());
  });

  function withCtx<T>(fId: string, fn: () => Promise<T>): Promise<T> {
    return RequestContextStore.run(
      { requestId: 'r', firmId: fId, auditorId: auditor, roles: ['lead_auditor'] },
      fn,
    );
  }

  it('creates a trace and projects the row to a DTO', async () => {
    canned.set('SELECT * FROM agent_traces WHERE id =', [
      {
        id: 't1',
        firm_id: firm,
        engagement_id: '00000000-0000-4000-8000-000000000003',
        source: 'otel',
        spans: [],
        metadata: { __af: { name: 'sample', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' } },
        ingested_at: new Date(),
      },
    ]);
    const t = await withCtx(firm, () => repo.create(firm, { name: 'sample' }));
    expect(t.id).toBe('t1');
    expect(t.name).toBe('sample');
  });

  it('emits set_tenant_context inside the transaction (RLS)', async () => {
    canned.set('SELECT * FROM agent_traces WHERE id =', [
      {
        id: 't2', firm_id: firm, engagement_id: '00000000-0000-4000-8000-000000000003',
        source: 'otel', spans: [], metadata: { __af: { name: 'x' } }, ingested_at: new Date(),
      },
    ]);
    await withCtx(firm, () => repo.findById(firm, 't2'));
    expect(sqlMock.recorded.some((r) => /set_tenant_context/.test(r.sql))).toBe(true);
  });

  it('throws NotFoundError when missing', async () => {
    canned.set('SELECT * FROM agent_traces WHERE id =', []);
    await expect(withCtx(firm, () => repo.findById(firm, 'missing'))).rejects.toThrow();
  });

  it('paginates with limit+1', async () => {
    canned.set('SELECT * FROM agent_traces WHERE firm_id =', [
      { id: 'a', firm_id: firm, engagement_id: 'e', source: 'otel', spans: [], metadata: { __af: { name: 'a' } }, ingested_at: new Date() },
      { id: 'b', firm_id: firm, engagement_id: 'e', source: 'otel', spans: [], metadata: { __af: { name: 'b' } }, ingested_at: new Date() },
      { id: 'c', firm_id: firm, engagement_id: 'e', source: 'otel', spans: [], metadata: { __af: { name: 'c' } }, ingested_at: new Date() },
    ]);
    const page = await withCtx(firm, () => repo.list(firm, { limit: 2 }));
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBe('b');
  });

  it('isolates by firm (RLS firm_id parameter)', async () => {
    canned.set('SELECT * FROM agent_traces WHERE id =', []);
    await expect(withCtx(otherFirm, () => repo.findById(otherFirm, 't1'))).rejects.toThrow();
    const allParams = sqlMock.recorded.flatMap((r) => r.params).filter((p) => typeof p === 'string');
    expect(allParams.some((p) => p === otherFirm)).toBe(true);
  });

  it('ingest path normalizes payload and inserts', async () => {
    canned.set('SELECT * FROM agent_traces WHERE id =', [
      {
        id: 'ti', firm_id: firm, engagement_id: '00000000-0000-4000-8000-000000000003',
        source: 'langfuse', spans: [{ name: 's' }], metadata: { __af: { name: 'imported' } }, ingested_at: new Date(),
      },
    ]);
    const t = await withCtx(firm, () => repo.ingest(firm, { name: 'imported', source: 'langfuse', spans: [{ name: 's' }] }));
    expect(t.id).toBe('ti');
  });
});
