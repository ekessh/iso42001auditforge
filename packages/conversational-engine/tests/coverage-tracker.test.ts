// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it, vi } from 'vitest';
import { CoverageTracker } from '../src/coverage-tracker/index.js';
import type { CoverageDelta } from '../src/types/domain.js';
import { asClaimId, asClauseId } from '../src/types/ids.js';
import { ENGAGEMENT } from './fixtures.js';

function delta(
  clauseId: string,
  fromStatus: CoverageDelta['fromStatus'],
  toStatus: CoverageDelta['toStatus'],
  at = '2026-05-03T10:00:00Z',
  claimId = 'cid-1',
  reason = 'r',
): CoverageDelta {
  return {
    engagementId: ENGAGEMENT,
    clauseId: asClauseId(clauseId),
    fromStatus,
    toStatus,
    confidenceDelta: 0.5,
    claimId: asClaimId(claimId),
    reason,
    at,
  };
}

describe('CoverageTracker — transitions', () => {
  it('untouched -> partial -> evidenced', () => {
    const t = new CoverageTracker();
    t.applyDelta(delta('6.1.2', 'untouched', 'partial'));
    t.applyDelta(delta('6.1.2', 'partial', 'evidenced'));
    const map = t.asCoverageMap(ENGAGEMENT);
    expect(map.get('6.1.2')!.status).toBe('evidenced');
  });

  it('rejects illegal transitions', () => {
    const t = new CoverageTracker();
    expect(() => t.applyDelta(delta('6.1.2', 'evidenced', 'untouched'))).toThrow();
  });

  it('rejects fromStatus that does not match current state', () => {
    const t = new CoverageTracker();
    t.applyDelta(delta('6.1.2', 'untouched', 'partial'));
    expect(() => t.applyDelta(delta('6.1.2', 'untouched', 'evidenced'))).toThrow();
  });

  it('partial -> evidenced is allowed', () => {
    const t = new CoverageTracker();
    t.applyDelta(delta('8.1', 'untouched', 'partial'));
    t.applyDelta(delta('8.1', 'partial', 'evidenced'));
    expect(t.asCoverageMap(ENGAGEMENT).get('8.1')!.status).toBe('evidenced');
  });

  it('contradicted can transition back to partial or evidenced', () => {
    const t = new CoverageTracker();
    t.applyDelta(delta('8.1', 'untouched', 'evidenced'));
    t.applyDelta(delta('8.1', 'evidenced', 'contradicted'));
    t.applyDelta(delta('8.1', 'contradicted', 'evidenced'));
    expect(t.asCoverageMap(ENGAGEMENT).get('8.1')!.status).toBe('evidenced');
  });

  it('na is a terminal state', () => {
    const t = new CoverageTracker();
    t.applyDelta(delta('A.7.6', 'untouched', 'na'));
    expect(() => t.applyDelta(delta('A.7.6', 'na', 'partial'))).toThrow();
  });
});

describe('CoverageTracker — history', () => {
  it('records every transition', () => {
    const t = new CoverageTracker();
    t.applyDelta(delta('6.1.2', 'untouched', 'partial', '2026-05-01T10:00:00Z'));
    t.applyDelta(delta('6.1.2', 'partial', 'evidenced', '2026-05-02T10:00:00Z'));
    const history = t.getHistory(ENGAGEMENT, asClauseId('6.1.2'));
    expect(history.length).toBe(2);
    expect(history[0]!.toStatus).toBe('partial');
    expect(history[1]!.toStatus).toBe('evidenced');
  });

  it('history captures the reason', () => {
    const t = new CoverageTracker();
    t.applyDelta(delta('6.1.2', 'untouched', 'partial', undefined, 'cid', 'auditor confirmed'));
    expect(t.getHistory(ENGAGEMENT)[0]!.reason).toBe('auditor confirmed');
  });

  it('recompute() replays history into deterministic state', () => {
    const t = new CoverageTracker();
    t.applyDelta(delta('6.1.2', 'untouched', 'partial'));
    t.applyDelta(delta('6.1.2', 'partial', 'evidenced'));
    t.recompute(ENGAGEMENT);
    expect(t.asCoverageMap(ENGAGEMENT).get('6.1.2')!.status).toBe('evidenced');
  });
});

describe('CoverageTracker — area threshold detection', () => {
  it('emits areaCovered when all clauses are evidenced', () => {
    const t = new CoverageTracker({
      areas: [
        {
          engagementId: ENGAGEMENT,
          areaId: 'risk',
          clauseIds: [asClauseId('6.1.2'), asClauseId('6.1.4')],
        },
      ],
    });
    const listener = vi.fn();
    t.onAreaCovered(listener);
    t.applyDelta(delta('6.1.2', 'untouched', 'evidenced'));
    expect(listener).not.toHaveBeenCalled();
    t.applyDelta(delta('6.1.4', 'untouched', 'evidenced'));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]![0].areaId).toBe('risk');
  });

  it('areaCovered fires only once per area', () => {
    const t = new CoverageTracker({
      areas: [
        {
          engagementId: ENGAGEMENT,
          areaId: 'risk',
          clauseIds: [asClauseId('6.1.2')],
        },
      ],
    });
    const listener = vi.fn();
    t.onAreaCovered(listener);
    t.applyDelta(delta('6.1.2', 'untouched', 'evidenced'));
    t.applyDelta(delta('6.1.2', 'evidenced', 'partial'));
    t.applyDelta(delta('6.1.2', 'partial', 'evidenced'));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('areaCovered fires when an area is covered by mixed evidenced + na', () => {
    const t = new CoverageTracker({
      areas: [
        {
          engagementId: ENGAGEMENT,
          areaId: 'risk',
          clauseIds: [asClauseId('6.1.2'), asClauseId('A.7.6')],
        },
      ],
    });
    const listener = vi.fn();
    t.onAreaCovered(listener);
    t.applyDelta(delta('6.1.2', 'untouched', 'evidenced'));
    t.applyDelta(delta('A.7.6', 'untouched', 'na'));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not emit when only some clauses are covered', () => {
    const t = new CoverageTracker({
      areas: [
        {
          engagementId: ENGAGEMENT,
          areaId: 'risk',
          clauseIds: [asClauseId('6.1.2'), asClauseId('6.1.4'), asClauseId('A.7.6')],
        },
      ],
    });
    const listener = vi.fn();
    t.onAreaCovered(listener);
    t.applyDelta(delta('6.1.2', 'untouched', 'evidenced'));
    t.applyDelta(delta('6.1.4', 'untouched', 'evidenced'));
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('CoverageTracker — read API', () => {
  it('getState returns the requested clauses', () => {
    const t = new CoverageTracker();
    t.applyDelta(delta('6.1.2', 'untouched', 'evidenced'));
    const m = t.getState(ENGAGEMENT, [asClauseId('6.1.2'), asClauseId('NEVER')]);
    expect(m.size).toBe(1);
  });

  it('asCoverageMap returns string-keyed map for engine consumption', () => {
    const t = new CoverageTracker();
    t.applyDelta(delta('6.1.2', 'untouched', 'partial'));
    const m = t.asCoverageMap(ENGAGEMENT);
    expect(m.get('6.1.2')).toBeDefined();
  });

  it('appends claim ids without duplication', () => {
    const t = new CoverageTracker();
    t.applyDelta(delta('6.1.2', 'untouched', 'partial', undefined, 'cid-x'));
    t.applyDelta(delta('6.1.2', 'partial', 'evidenced', undefined, 'cid-x'));
    const s = t.asCoverageMap(ENGAGEMENT).get('6.1.2')!;
    expect(s.lastClaimIds.length).toBe(1);
  });

  it('clamps confidence to [0,1]', () => {
    const t = new CoverageTracker();
    t.applyDelta({
      ...delta('6.1.2', 'untouched', 'partial'),
      confidenceDelta: 5,
    });
    expect(t.asCoverageMap(ENGAGEMENT).get('6.1.2')!.confidence).toBe(1);
  });
});

describe('CoverageTracker — registerArea', () => {
  it('areas can be registered after construction', () => {
    const t = new CoverageTracker();
    const listener = vi.fn();
    t.onAreaCovered(listener);
    t.registerArea({
      engagementId: ENGAGEMENT,
      areaId: 'late',
      clauseIds: [asClauseId('9.1')],
    });
    t.applyDelta(delta('9.1', 'untouched', 'evidenced'));
    expect(listener).toHaveBeenCalled();
  });
});
