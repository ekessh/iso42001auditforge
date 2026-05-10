// SPDX-License-Identifier: BUSL-1.1
//
// ReportsRepository — Drizzle path test. Mirrors the clients repo strategy:
// a fake postgres-js client records queries and returns canned rows, letting
// us validate the DB code path without a live Postgres.

import { describe, it, expect, beforeEach } from 'vitest';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { RequestContextStore } from '../../common/request-context.js';
import { ReportsRepository } from './reports.repository.js';

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

describe('ReportsRepository (DB path)', () => {
  const firm = '11111111-1111-1111-1111-111111111111';
  const auditor = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const eng = '99999999-9999-9999-9999-999999999999';

  let repo: ReportsRepository;
  let canned: Map<string, unknown[]>;
  let sqlMock: ReturnType<typeof makeFakeSql>;

  beforeEach(() => {
    canned = new Map();
    sqlMock = makeFakeSql(canned);
    repo = new ReportsRepository(sqlMock as never, new TenancyAdapter());
  });

  function withCtx<T>(fn: () => Promise<T>): Promise<T> {
    return RequestContextStore.run(
      { requestId: 'r', firmId: firm, auditorId: auditor, roles: ['lead_auditor'] },
      fn,
    );
  }

  it('creates a draft report and projects DB row to DTO', async () => {
    canned.set('SELECT * FROM audit_reports WHERE id = ', [
      {
        id: 'r1',
        firm_id: firm,
        engagement_id: eng,
        report_type: 'stage1',
        state: 'draft',
        payload: { title: 'S1', bodyMarkdown: '# Hello', version: 1 },
        created_at: new Date('2026-01-01T00:00:00Z'),
        updated_at: new Date('2026-01-01T00:00:00Z'),
        signed_at: null,
        issued_at: null,
      },
    ]);
    const created = await withCtx(() =>
      repo.create(firm, { engagementId: eng, kind: 'stage1', title: 'S1', bodyMarkdown: '# Hello' }),
    );
    expect(created.id).toBe('r1');
    expect(created.kind).toBe('stage1');
    expect(created.status).toBe('draft');
    expect(created.title).toBe('S1');
    expect(created.bodyMarkdown).toBe('# Hello');
    expect(created.version).toBe(1);
  });

  it('maps DB state "issued" to API status "issued" and surfaces issuedAt', async () => {
    canned.set('SELECT * FROM audit_reports WHERE id = ', [
      {
        id: 'r2',
        firm_id: firm,
        engagement_id: eng,
        report_type: 'stage2',
        state: 'issued',
        payload: { title: 'S2', bodyMarkdown: 'body', version: 3, signedBy: 'a1', signatureRef: 'sig' },
        created_at: new Date('2026-01-01T00:00:00Z'),
        updated_at: new Date('2026-02-01T00:00:00Z'),
        signed_at: new Date('2026-02-01T00:00:00Z'),
        issued_at: new Date('2026-02-01T00:00:00Z'),
      },
    ]);
    const r = await withCtx(() => repo.findById(firm, 'r2'));
    expect(r.status).toBe('issued');
    expect(r.signedBy).toBe('a1');
    expect(r.signatureRef).toBe('sig');
    expect(r.issuedAt).toBe('2026-02-01T00:00:00.000Z');
  });

  it('paginates and signals more pages with cursor', async () => {
    canned.set(
      'SELECT * FROM audit_reports WHERE firm_id =',
      [
        { id: 'a', firm_id: firm, engagement_id: eng, report_type: 'stage1', state: 'draft', payload: { title: 'A', bodyMarkdown: '', version: 1 }, created_at: new Date(), updated_at: new Date(), signed_at: null, issued_at: null },
        { id: 'b', firm_id: firm, engagement_id: eng, report_type: 'stage1', state: 'draft', payload: { title: 'B', bodyMarkdown: '', version: 1 }, created_at: new Date(), updated_at: new Date(), signed_at: null, issued_at: null },
        { id: 'c', firm_id: firm, engagement_id: eng, report_type: 'stage1', state: 'draft', payload: { title: 'C', bodyMarkdown: '', version: 1 }, created_at: new Date(), updated_at: new Date(), signed_at: null, issued_at: null },
      ],
    );
    const page = await withCtx(() => repo.list(firm, { limit: 2 }));
    expect(page.items.length).toBe(2);
    expect(page.nextCursor).toBe('b');
  });

  it('throws NotFoundError when the row is missing', async () => {
    canned.set('SELECT * FROM audit_reports WHERE id = ', []);
    await expect(withCtx(() => repo.findById(firm, 'missing'))).rejects.toThrow();
  });

  it('emits set_tenant_context inside the transaction', async () => {
    canned.set('SELECT * FROM audit_reports WHERE id = ', [
      { id: 'r1', firm_id: firm, engagement_id: eng, report_type: 'stage1', state: 'draft', payload: { title: 't', bodyMarkdown: '', version: 1 }, created_at: new Date(), updated_at: new Date(), signed_at: null, issued_at: null },
    ]);
    await withCtx(() => repo.findById(firm, 'r1'));
    const seen = sqlMock.recorded.map((r) => r.sql);
    expect(seen.some((s) => /set_tenant_context/.test(s))).toBe(true);
  });
});
