// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect, beforeEach } from 'vitest';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';
import { CrossEngagementMemoryRepository } from './cross-engagement-memory.repository.js';
import { CrossEngagementMemoryService } from './cross-engagement-memory.service.js';

const FIRM = '11111111-1111-1111-1111-111111111111';
const AUDITOR = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

function makeRepo(): CrossEngagementMemoryRepository {
  const stubSql = {} as never;
  return new CrossEngagementMemoryRepository(stubSql, new TenancyAdapter());
}

describe('CrossEngagementMemoryService', () => {
  let svc: CrossEngagementMemoryService;
  let ledger: AuditEngineAdapter;
  let repo: CrossEngagementMemoryRepository;

  beforeEach(() => {
    repo = makeRepo();
    ledger = new AuditEngineAdapter();
    svc = new CrossEngagementMemoryService(repo, ledger);
  });

  it('aggregate creates patterns and emits a ledger event', async () => {
    const r = await svc.aggregate({
      firmId: FIRM,
      auditorId: AUDITOR,
      request: {
        engagementId: 'eng-1',
        scopeDimensions: { industry: 'healthcare' },
        clauseObservations: [
          { clauseId: 'A.7.4', status: 'partial' },
          { clauseId: 'A.7.4', status: 'evidenced' },
        ],
        probeOutcomes: [{ probeId: 'P-LLM-15', passed: false }],
      },
    });
    expect(r.patternsTouched).toBeGreaterThan(0);
    const events = await ledger.list({ firmId: FIRM });
    const types = events.map((e) => e.type);
    expect(types).toContain('cross-engagement-memory.aggregated');
  });

  it('list returns aggregated rows and emits a ledger event', async () => {
    await svc.aggregate({
      firmId: FIRM,
      auditorId: AUDITOR,
      request: {
        engagementId: 'eng-1',
        scopeDimensions: { industry: 'healthcare' },
        clauseObservations: [{ clauseId: 'A.7.4', status: 'partial' }],
        probeOutcomes: [],
      },
    });
    const out = await svc.list({
      firmId: FIRM,
      auditorId: AUDITOR,
      kind: 'clause_evidence_failure_rate',
      limit: 50,
    });
    expect(out.items.length).toBeGreaterThan(0);
    expect(out.items.every((p) => p.firmId === FIRM)).toBe(true);
    const events = await ledger.list({ firmId: FIRM });
    expect(events.some((e) => e.type === 'cross-engagement-memory.queried')).toBe(true);
  });

  it('list filters by scope', async () => {
    await svc.aggregate({
      firmId: FIRM,
      auditorId: AUDITOR,
      request: {
        engagementId: 'eng-1',
        scopeDimensions: { industry: 'healthcare' },
        clauseObservations: [{ clauseId: 'A.7.4', status: 'partial' }],
        probeOutcomes: [],
      },
    });
    const out = await svc.list({
      firmId: FIRM,
      auditorId: AUDITOR,
      scope: { industry: 'finance' },
      limit: 50,
    });
    expect(out.items.length).toBe(0);
  });
});
