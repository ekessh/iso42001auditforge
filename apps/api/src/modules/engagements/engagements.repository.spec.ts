// SPDX-License-Identifier: BUSL-1.1
//
// EngagementsRepository — Drizzle path tests.
// Mirrors the harness from clients.repository.spec.ts: a fake `sql.begin`
// records every tagged-template SQL string and returns canned rows by
// prefix. Validates the row->DTO projection (sidecar metadata extraction),
// pagination, NotFound and RLS session-var emission.

import { describe, it, expect, beforeEach } from 'vitest';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { RequestContextStore } from '../../common/request-context.js';
import { EngagementsRepository } from './engagements.repository.js';
import type { CreateEngagementDto } from './dto.js';

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

describe('EngagementsRepository (DB path)', () => {
  const firm = '11111111-1111-1111-1111-111111111111';
  const auditor = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const otherFirm = '22222222-2222-2222-2222-222222222222';

  let repo: EngagementsRepository;
  let canned: Map<string, unknown[]>;
  let sqlMock: ReturnType<typeof makeFakeSql>;

  const baseDto: CreateEngagementDto = {
    clientId: '33333333-3333-3333-3333-333333333333',
    mode: 'audit',
    stage: 'stage1',
    scopeStatement: 'AIMS coverage',
    startsOn: '2026-06-01',
    endsOn: '2026-06-05',
    leadAuditorId: '44444444-4444-4444-4444-444444444444',
    teamMemberIds: [],
  };

  beforeEach(() => {
    canned = new Map();
    sqlMock = makeFakeSql(canned);
    repo = new EngagementsRepository(sqlMock as never, new TenancyAdapter());
  });

  function withCtx<T>(fId: string, fn: () => Promise<T>): Promise<T> {
    return RequestContextStore.run(
      { requestId: 'r', firmId: fId, auditorId: auditor, roles: ['lead_auditor'] },
      fn,
    );
  }

  it('routes through the DB path when sql.begin is callable and returns mapped DTO', async () => {
    canned.set('SELECT * FROM engagements WHERE id =', [
      {
        id: 'e1',
        firm_id: firm,
        client_id: baseDto.clientId,
        code: 'ENG-abc',
        mode: 'audit',
        stage: 'stage1',
        status: 'planned',
        metadata: {
          __af: {
            scopeStatement: 'AIMS coverage',
            startsOn: '2026-06-01',
            endsOn: '2026-06-05',
            leadAuditorId: baseDto.leadAuditorId,
            teamMemberIds: [],
          },
          owner: 'CISO',
        },
        created_at: new Date('2026-01-01T00:00:00Z'),
        updated_at: new Date('2026-01-01T00:00:00Z'),
        archived_at: null,
      },
    ]);

    const created = await withCtx(firm, () => repo.create(firm, baseDto));
    expect(created.id).toBe('e1');
    expect(created.firmId).toBe(firm);
    expect(created.scopeStatement).toBe('AIMS coverage');
    expect(created.metadata).toEqual({ owner: 'CISO' });
    expect(created.status).toBe('planned');
  });

  it('emits set_tenant_context inside the transaction (RLS session vars)', async () => {
    canned.set('SELECT * FROM engagements WHERE id =', [
      {
        id: 'e2',
        firm_id: firm,
        client_id: baseDto.clientId,
        code: 'ENG-x',
        mode: 'audit',
        stage: 'stage1',
        status: 'planned',
        metadata: { __af: {} },
        created_at: new Date(),
        updated_at: new Date(),
        archived_at: null,
      },
    ]);
    await withCtx(firm, () => repo.findById(firm, 'e2'));
    const seen = sqlMock.recorded.map((r) => r.sql);
    expect(seen.some((s) => /set_tenant_context/.test(s))).toBe(true);
  });

  it('throws NotFoundError when the engagement is missing', async () => {
    canned.set('SELECT * FROM engagements WHERE id =', []);
    await expect(withCtx(firm, () => repo.findById(firm, 'missing'))).rejects.toThrow();
  });

  it('paginates with limit+1 and exposes a cursor when more rows are available', async () => {
    canned.set('SELECT * FROM engagements WHERE firm_id =', [
      {
        id: 'a', firm_id: firm, client_id: baseDto.clientId, code: 'a', mode: 'audit',
        stage: 'stage1', status: 'planned', metadata: { __af: {} },
        created_at: new Date(), updated_at: new Date(), archived_at: null,
      },
      {
        id: 'b', firm_id: firm, client_id: baseDto.clientId, code: 'b', mode: 'audit',
        stage: 'stage1', status: 'planned', metadata: { __af: {} },
        created_at: new Date(), updated_at: new Date(), archived_at: null,
      },
      {
        id: 'c', firm_id: firm, client_id: baseDto.clientId, code: 'c', mode: 'audit',
        stage: 'stage1', status: 'planned', metadata: { __af: {} },
        created_at: new Date(), updated_at: new Date(), archived_at: null,
      },
    ]);
    const page = await withCtx(firm, () => repo.list(firm, { limit: 2 }));
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBe('b');
  });

  it('isolates engagements between firms (RLS session var changes per call)', async () => {
    canned.set('SELECT * FROM engagements WHERE id =', []);
    await expect(withCtx(otherFirm, () => repo.findById(otherFirm, 'e1'))).rejects.toThrow();
    const seen = sqlMock.recorded.flatMap((r) => r.params).filter((p) => typeof p === 'string');
    expect(seen.some((p) => p === otherFirm)).toBe(true);
  });
});
