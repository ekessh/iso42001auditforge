// SPDX-License-Identifier: BUSL-1.1
//
// ProbesRepository — Drizzle path test. Mirrors the clients repo strategy:
// a fake postgres-js client records queries and returns canned rows, letting
// us validate the DB code path without a live Postgres.

import { describe, it, expect, beforeEach } from 'vitest';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { RequestContextStore } from '../../common/request-context.js';
import { ProbesRepository } from './probes.repository.js';

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

  const sql = {
    recorded,
    begin: async <T,>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn(tagged),
  };
  return sql;
}

describe('ProbesRepository (DB path)', () => {
  const firm = '11111111-1111-1111-1111-111111111111';
  const auditor = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const eng = '99999999-9999-9999-9999-999999999999';

  let repo: ProbesRepository;
  let canned: Map<string, unknown[]>;
  let sqlMock: ReturnType<typeof makeFakeSql>;

  beforeEach(() => {
    canned = new Map();
    sqlMock = makeFakeSql(canned);
    repo = new ProbesRepository(sqlMock as never, new TenancyAdapter());
  });

  function withCtx<T>(fn: () => Promise<T>): Promise<T> {
    return RequestContextStore.run(
      { requestId: 'r', firmId: firm, auditorId: auditor, roles: ['lead_auditor'] },
      fn,
    );
  }

  it('createDefinition packs auditor extras into the spec JSONB blob', async () => {
    canned.set('SELECT * FROM probe_definitions WHERE id = ', [
      {
        id: 'p1',
        firm_id: firm,
        name: 'Bias check',
        mode: 'offline',
        spec: {
          category: 'fairness',
          spec: { dataset: 'test' },
          budgetUsd: 10,
          cpuMs: 60_000,
          memMb: 512,
        },
        created_at: new Date('2026-01-01T00:00:00Z'),
        updated_at: new Date('2026-01-01T00:00:00Z'),
      },
    ]);
    const def = await withCtx(() =>
      repo.createDefinition(firm, {
        name: 'Bias check',
        category: 'fairness',
        mode: 'offline',
        spec: { dataset: 'test' },
        budgetUsd: 10,
        cpuMs: 60_000,
        memMb: 512,
      }),
    );
    expect(def.name).toBe('Bias check');
    expect(def.category).toBe('fairness');
    expect(def.budgetUsd).toBe(10);
    expect(def.spec).toEqual({ dataset: 'test' });
  });

  it('createExecution stores jobId in the output blob and projects to DTO', async () => {
    canned.set('SELECT * FROM probe_executions WHERE id = ', [
      {
        id: 'e1',
        firm_id: firm,
        engagement_id: eng,
        probe_definition_id: 'p1',
        status: 'queued',
        verdict: null,
        started_at: null,
        finished_at: null,
        output: { jobId: 'job-1', costUsd: 0 },
        created_at: new Date(),
      },
    ]);
    const ex = await withCtx(() => repo.createExecution(firm, 'p1', { engagementId: eng, parameters: {} }, 'job-1'));
    expect(ex.status).toBe('queued');
    expect(ex.jobId).toBe('job-1');
    expect(ex.costUsd).toBe(0);
  });

  it('sumCostByEngagement runs an aggregate query', async () => {
    canned.set(
      'SELECT COALESCE(SUM',
      [{ sum: 42.5 }],
    );
    const total = await withCtx(() => repo.sumCostByEngagement(firm, eng));
    expect(total).toBe(42.5);
  });

  it('lists definitions and signals more pages', async () => {
    canned.set(
      'SELECT * FROM probe_definitions WHERE firm_id =',
      [
        { id: 'p1', firm_id: firm, name: 'a', mode: 'offline', spec: { category: 'c', spec: {}, budgetUsd: 0, cpuMs: 1, memMb: 1 }, created_at: new Date(), updated_at: new Date() },
        { id: 'p2', firm_id: firm, name: 'b', mode: 'offline', spec: { category: 'c', spec: {}, budgetUsd: 0, cpuMs: 1, memMb: 1 }, created_at: new Date(), updated_at: new Date() },
        { id: 'p3', firm_id: firm, name: 'c', mode: 'offline', spec: { category: 'c', spec: {}, budgetUsd: 0, cpuMs: 1, memMb: 1 }, created_at: new Date(), updated_at: new Date() },
      ],
    );
    const page = await withCtx(() => repo.listDefinitions(firm, { limit: 2 }));
    expect(page.items.length).toBe(2);
    expect(page.nextCursor).toBe('p2');
  });

  it('emits set_tenant_context inside the transaction', async () => {
    canned.set('SELECT * FROM probe_definitions WHERE id = ', [
      { id: 'p1', firm_id: firm, name: 'a', mode: 'offline', spec: { category: 'c', spec: {}, budgetUsd: 0, cpuMs: 1, memMb: 1 }, created_at: new Date(), updated_at: new Date() },
    ]);
    await withCtx(() => repo.findDefinition(firm, 'p1'));
    const seen = sqlMock.recorded.map((r) => r.sql);
    expect(seen.some((s) => /set_tenant_context/.test(s))).toBe(true);
  });
});
