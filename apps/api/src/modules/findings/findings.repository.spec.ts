// SPDX-License-Identifier: BUSL-1.1
//
// FindingsRepository — Drizzle path tests.
// Uses the same fake-sql harness pattern as clients.repository.spec.ts.

import { describe, it, expect, beforeEach } from 'vitest';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { RequestContextStore } from '../../common/request-context.js';
import { FindingsRepository } from './findings.repository.js';
import type { CreateFindingDto } from './dto.js';

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

describe('FindingsRepository (DB path)', () => {
  const firm = '11111111-1111-1111-1111-111111111111';
  const auditor = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const otherFirm = '22222222-2222-2222-2222-222222222222';
  const eng = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

  const baseDto: CreateFindingDto = {
    engagementId: eng,
    controlRef: 'A.6.2',
    severity: 'major_nc',
    title: 'Title',
    description: 'Desc',
    evidence: [],
  };

  let repo: FindingsRepository;
  let canned: Map<string, unknown[]>;
  let sqlMock: ReturnType<typeof makeFakeSql>;

  beforeEach(() => {
    canned = new Map();
    sqlMock = makeFakeSql(canned);
    repo = new FindingsRepository(sqlMock as never, new TenancyAdapter());
  });

  function withCtx<T>(fId: string, fn: () => Promise<T>): Promise<T> {
    return RequestContextStore.run(
      { requestId: 'r', firmId: fId, auditorId: auditor, roles: ['lead_auditor'] },
      fn,
    );
  }

  it('creates and returns the mapped DTO from the row', async () => {
    canned.set('SELECT * FROM findings WHERE id =', [
      {
        id: 'f1',
        firm_id: firm,
        engagement_id: eng,
        finding_type: 'major_nc',
        finding_state: 'draft',
        title: 'Title',
        description: 'Desc',
        raised_at: new Date(),
        resolved_at: null,
        metadata: { __af: { controlRef: 'A.6.2', evidence: [], status: 'capa_pending' } },
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
    const f = await withCtx(firm, () => repo.create(firm, baseDto));
    expect(f.id).toBe('f1');
    expect(f.severity).toBe('major_nc');
    expect(f.controlRef).toBe('A.6.2');
    expect(f.status).toBe('capa_pending');
  });

  it('emits set_tenant_context inside the transaction', async () => {
    canned.set('SELECT * FROM findings WHERE id =', [
      {
        id: 'f2', firm_id: firm, engagement_id: eng,
        finding_type: 'minor_nc', finding_state: 'draft', title: 't', description: 'd',
        raised_at: new Date(), resolved_at: null,
        metadata: { __af: { controlRef: 'A.7', evidence: [], status: 'open' } },
        created_at: new Date(), updated_at: new Date(),
      },
    ]);
    await withCtx(firm, () => repo.findById(firm, 'f2'));
    expect(sqlMock.recorded.some((r) => /set_tenant_context/.test(r.sql))).toBe(true);
  });

  it('throws NotFoundError when the finding is missing', async () => {
    canned.set('SELECT * FROM findings WHERE id =', []);
    await expect(withCtx(firm, () => repo.findById(firm, 'missing'))).rejects.toThrow();
  });

  it('paginates with limit+1 over engagement-scoped query', async () => {
    canned.set('SELECT * FROM findings WHERE firm_id =', [
      {
        id: 'a', firm_id: firm, engagement_id: eng,
        finding_type: 'minor_nc', finding_state: 'draft', title: 'a', description: 'd',
        raised_at: new Date(), resolved_at: null,
        metadata: { __af: { controlRef: 'A', evidence: [], status: 'open' } },
        created_at: new Date(), updated_at: new Date(),
      },
      {
        id: 'b', firm_id: firm, engagement_id: eng,
        finding_type: 'minor_nc', finding_state: 'draft', title: 'b', description: 'd',
        raised_at: new Date(), resolved_at: null,
        metadata: { __af: { controlRef: 'B', evidence: [], status: 'open' } },
        created_at: new Date(), updated_at: new Date(),
      },
      {
        id: 'c', firm_id: firm, engagement_id: eng,
        finding_type: 'minor_nc', finding_state: 'draft', title: 'c', description: 'd',
        raised_at: new Date(), resolved_at: null,
        metadata: { __af: { controlRef: 'C', evidence: [], status: 'open' } },
        created_at: new Date(), updated_at: new Date(),
      },
    ]);
    const page = await withCtx(firm, () => repo.list(firm, { engagementId: eng, limit: 2 }));
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBe('b');
  });

  it('isolates findings by firmId (RLS session var emitted with otherFirm)', async () => {
    canned.set('SELECT * FROM findings WHERE id =', []);
    await expect(withCtx(otherFirm, () => repo.findById(otherFirm, 'f1'))).rejects.toThrow();
    const allParams = sqlMock.recorded.flatMap((r) => r.params).filter((p) => typeof p === 'string');
    expect(allParams.some((p) => p === otherFirm)).toBe(true);
  });

  it('promoteCandidate inserts finding and stamps candidate as promoted', async () => {
    canned.set('SELECT * FROM findings WHERE id =', [
      {
        id: 'fp', firm_id: firm, engagement_id: eng,
        finding_type: 'minor_nc', finding_state: 'open', title: 'T', description: 'D',
        raised_at: new Date(), resolved_at: null,
        metadata: { __af: { controlRef: 'CF', evidence: [], status: 'capa_pending' }, promotedFromCandidateId: 'cf-1' },
        created_at: new Date(), updated_at: new Date(),
      },
    ]);
    const f = await withCtx(firm, () =>
      repo.promoteCandidate(firm, 'cf-1', {
        engagementId: eng,
        severity: 'minor_nc',
        title: 'T',
        description: 'D',
      }),
    );
    expect(f.id).toBe('fp');
    expect(sqlMock.recorded.some((r) => /UPDATE candidate_findings/.test(r.sql))).toBe(true);
  });
});
