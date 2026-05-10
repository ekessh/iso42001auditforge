// SPDX-License-Identifier: BUSL-1.1
//
// WorkingPapersRepository — Drizzle path tests.
// Mirrors the harness from clients.repository.spec.ts.

import { describe, it, expect, beforeEach } from 'vitest';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { RequestContextStore } from '../../common/request-context.js';
import { WorkingPapersRepository } from './working-papers.repository.js';
import type { CreateWorkingPaperDto } from './dto.js';

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

describe('WorkingPapersRepository (DB path)', () => {
  const firm = '11111111-1111-1111-1111-111111111111';
  const otherFirm = '22222222-2222-2222-2222-222222222222';
  const auditor = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const eng = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

  const baseDto: CreateWorkingPaperDto = {
    engagementId: eng,
    title: 'WP',
    controlRef: 'A.6.2',
    bodyMarkdown: '',
    evidenceRefs: [],
  };

  let repo: WorkingPapersRepository;
  let canned: Map<string, unknown[]>;
  let sqlMock: ReturnType<typeof makeFakeSql>;

  beforeEach(() => {
    canned = new Map();
    sqlMock = makeFakeSql(canned);
    repo = new WorkingPapersRepository(sqlMock as never, new TenancyAdapter());
  });

  function withCtx<T>(fId: string, fn: () => Promise<T>): Promise<T> {
    return RequestContextStore.run(
      { requestId: 'r', firmId: fId, auditorId: auditor, roles: ['lead_auditor'] },
      fn,
    );
  }

  it('creates a draft and projects the row', async () => {
    canned.set('SELECT * FROM working_papers WHERE id =', [
      {
        id: 'wp1', firm_id: firm, engagement_id: eng, title: 'WP', verdict: null,
        body: { __af: { controlRef: 'A.6.2', bodyMarkdown: '', evidenceRefs: [], status: 'draft', version: 1 } },
        created_at: new Date(), updated_at: new Date(), archived_at: null,
      },
    ]);
    const wp = await withCtx(firm, () => repo.create(firm, baseDto));
    expect(wp.id).toBe('wp1');
    expect(wp.status).toBe('draft');
    expect(wp.version).toBe(1);
    expect(wp.controlRef).toBe('A.6.2');
  });

  it('emits set_tenant_context inside the transaction (RLS)', async () => {
    canned.set('SELECT * FROM working_papers WHERE id =', [
      {
        id: 'wp2', firm_id: firm, engagement_id: eng, title: 't', verdict: null,
        body: { __af: { controlRef: 'A', bodyMarkdown: '', evidenceRefs: [], status: 'draft', version: 1 } },
        created_at: new Date(), updated_at: new Date(), archived_at: null,
      },
    ]);
    await withCtx(firm, () => repo.findById(firm, 'wp2'));
    expect(sqlMock.recorded.some((r) => /set_tenant_context/.test(r.sql))).toBe(true);
  });

  it('throws NotFoundError when missing', async () => {
    canned.set('SELECT * FROM working_papers WHERE id =', []);
    await expect(withCtx(firm, () => repo.findById(firm, 'missing'))).rejects.toThrow();
  });

  it('paginates with limit+1 over engagement-scoped query', async () => {
    canned.set('SELECT * FROM working_papers WHERE firm_id =', [
      { id: 'a', firm_id: firm, engagement_id: eng, title: 'a', verdict: null, body: { __af: { controlRef: 'A', bodyMarkdown: '', evidenceRefs: [], status: 'draft', version: 1 } }, created_at: new Date(), updated_at: new Date(), archived_at: null },
      { id: 'b', firm_id: firm, engagement_id: eng, title: 'b', verdict: null, body: { __af: { controlRef: 'B', bodyMarkdown: '', evidenceRefs: [], status: 'draft', version: 1 } }, created_at: new Date(), updated_at: new Date(), archived_at: null },
      { id: 'c', firm_id: firm, engagement_id: eng, title: 'c', verdict: null, body: { __af: { controlRef: 'C', bodyMarkdown: '', evidenceRefs: [], status: 'draft', version: 1 } }, created_at: new Date(), updated_at: new Date(), archived_at: null },
    ]);
    const page = await withCtx(firm, () => repo.list(firm, { engagementId: eng, limit: 2 }));
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBe('b');
  });

  it('isolates by firm', async () => {
    canned.set('SELECT * FROM working_papers WHERE id =', []);
    await expect(withCtx(otherFirm, () => repo.findById(otherFirm, 'wp1'))).rejects.toThrow();
    const allParams = sqlMock.recorded.flatMap((r) => r.params).filter((p) => typeof p === 'string');
    expect(allParams.some((p) => p === otherFirm)).toBe(true);
  });

  it('writes a version bump back to body JSONB on update', async () => {
    canned.set('SELECT * FROM working_papers WHERE id =', [
      {
        id: 'wp3', firm_id: firm, engagement_id: eng, title: 'old', verdict: null,
        body: { __af: { controlRef: 'A', bodyMarkdown: '', evidenceRefs: [], status: 'draft', version: 1 } },
        created_at: new Date(), updated_at: new Date(), archived_at: null,
      },
    ]);
    await withCtx(firm, () =>
      repo.update(firm, 'wp3', { title: 'new', bodyMarkdown: 'updated' }),
    );
    const updateCall = sqlMock.recorded.find((r) => /UPDATE working_papers/.test(r.sql));
    expect(updateCall).toBeDefined();
    const bodyParam = updateCall?.params.find(
      (p) => typeof p === 'string' && (p as string).includes('"version":2'),
    );
    expect(bodyParam).toBeDefined();
  });
});
