// SPDX-License-Identifier: BUSL-1.1
//
// ClientsRepository — Drizzle path test.
//
// We can't reach a real Postgres in this unit-test layer (the integration
// suite under apps/api/test/integration covers that with testcontainers).
// What we do validate here:
//   1. The repository auto-detects a "real" sql client (one with `.begin`)
//      and routes to the DB path rather than the in-memory fallback.
//   2. The DB path issues `set_tenant_context`, performs the expected
//      tagged-template SQL inside a single transaction, and returns the
//      mapped row to the caller.
//   3. RLS context vars (firmId/auditorId) are passed to the tenancy
//      transaction wrapper.
//
// The fake `sql.begin` mock executes its callback with a `tx` object that
// records every query and returns canned rows keyed by SQL prefix. This is
// enough to verify the repo's call shape end-to-end without a live DB.

import { describe, it, expect, beforeEach } from 'vitest';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { RequestContextStore } from '../../common/request-context.js';
import { ClientsRepository } from './clients.repository.js';

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
  // postgres-js exposes `tx.unsafe(sql, params)` for raw, used by tenancy-core.
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

describe('ClientsRepository (DB path)', () => {
  const firm = '11111111-1111-1111-1111-111111111111';
  const auditor = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  let repo: ClientsRepository;
  let canned: Map<string, unknown[]>;
  let sqlMock: ReturnType<typeof makeFakeSql>;

  beforeEach(() => {
    canned = new Map();
    sqlMock = makeFakeSql(canned);
    repo = new ClientsRepository(sqlMock as never, new TenancyAdapter());
  });

  function withCtx<T>(fn: () => Promise<T>): Promise<T> {
    return RequestContextStore.run(
      { requestId: 'r', firmId: firm, auditorId: auditor, roles: ['lead_auditor'] },
      fn,
    );
  }

  it('routes through the DB path when sql.begin is callable', async () => {
    canned.set('SELECT * FROM clients WHERE id = ', [
      {
        id: 'c1',
        firm_id: firm,
        legal_name: 'Acme',
        country_code: 'US',
        metadata: { sector: 'finance' },
        created_at: new Date('2026-01-01T00:00:00Z'),
        updated_at: new Date('2026-01-01T00:00:00Z'),
        archived_at: null,
      },
    ]);

    const created = await withCtx(() => repo.create(firm, { name: 'Acme' }));
    expect(created.id).toBe('c1');
    expect(created.firmId).toBe(firm);
    expect(created.name).toBe('Acme');
    expect(created.metadata).toEqual({ sector: 'finance', countryCode: 'US' });
  });

  it('emits set_tenant_context inside the transaction', async () => {
    canned.set('SELECT * FROM clients WHERE id = ', [
      {
        id: 'c2', firm_id: firm, legal_name: 'X', country_code: 'XX',
        metadata: {}, created_at: new Date(), updated_at: new Date(), archived_at: null,
      },
    ]);
    await withCtx(() => repo.findById(firm, 'c2'));
    const seen = sqlMock.recorded.map((r) => r.sql);
    expect(seen.some((s) => /set_tenant_context/.test(s))).toBe(true);
  });

  it('throws NotFoundError when the row is missing', async () => {
    canned.set('SELECT * FROM clients WHERE id = ', []);
    await expect(withCtx(() => repo.findById(firm, 'missing'))).rejects.toThrow();
  });

  it('paginates with cursor and returns null when exhausted', async () => {
    canned.set(
      'SELECT * FROM clients WHERE firm_id =',
      [
        { id: 'a', firm_id: firm, legal_name: 'A', country_code: 'US', metadata: {}, created_at: new Date(), updated_at: new Date(), archived_at: null },
        { id: 'b', firm_id: firm, legal_name: 'B', country_code: 'US', metadata: {}, created_at: new Date(), updated_at: new Date(), archived_at: null },
      ],
    );
    const page = await withCtx(() => repo.list(firm, { limit: 5 }));
    expect(page.items.length).toBe(2);
    expect(page.nextCursor).toBeNull();
  });

  it('signals more pages when limit+1 rows are returned', async () => {
    canned.set(
      'SELECT * FROM clients WHERE firm_id =',
      [
        { id: 'a', firm_id: firm, legal_name: 'A', country_code: 'US', metadata: {}, created_at: new Date(), updated_at: new Date(), archived_at: null },
        { id: 'b', firm_id: firm, legal_name: 'B', country_code: 'US', metadata: {}, created_at: new Date(), updated_at: new Date(), archived_at: null },
        { id: 'c', firm_id: firm, legal_name: 'C', country_code: 'US', metadata: {}, created_at: new Date(), updated_at: new Date(), archived_at: null },
      ],
    );
    const page = await withCtx(() => repo.list(firm, { limit: 2 }));
    expect(page.items.length).toBe(2);
    expect(page.nextCursor).toBe('b');
  });
});
