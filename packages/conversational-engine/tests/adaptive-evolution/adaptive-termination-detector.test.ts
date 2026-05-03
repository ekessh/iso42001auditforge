// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import {
  TerminationDetector,
  type AreaScopeRow,
} from '../../src/adaptive-evolution/adaptive-index.js';

const ENG = '11111111-1111-4111-8111-111111111111';
const NOW = '2026-05-03T10:00:00.000Z';

const det = new TerminationDetector();

function row(
  areaId: string,
  clauseId: string,
  status: AreaScopeRow['status'],
  inScope = true,
): AreaScopeRow {
  return { areaId, clauseId, status, inScope };
}

describe('TerminationDetector.detectAreaCovered', () => {
  it('emits areaCovered when all in-scope clauses are evidenced/na', () => {
    const out = det.detectAreaCovered(
      ENG,
      [
        row('A.6', 'A.6.2.5', 'evidenced'),
        row('A.6', 'A.6.2.8', 'na'),
      ],
      NOW,
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.kind).toBe('areaCovered');
    expect(out[0]!.areaId).toBe('A.6');
  });

  it('does not emit when any in-scope clause is untouched/partial/contradicted', () => {
    expect(
      det.detectAreaCovered(
        ENG,
        [row('A.6', 'A.6.2.5', 'evidenced'), row('A.6', 'A.6.2.8', 'untouched')],
        NOW,
      ),
    ).toHaveLength(0);
    expect(
      det.detectAreaCovered(
        ENG,
        [row('A.6', 'A.6.2.5', 'evidenced'), row('A.6', 'A.6.2.8', 'partial')],
        NOW,
      ),
    ).toHaveLength(0);
    expect(
      det.detectAreaCovered(
        ENG,
        [row('A.6', 'A.6.2.5', 'contradicted')],
        NOW,
      ),
    ).toHaveLength(0);
  });

  it('ignores out-of-scope rows', () => {
    const out = det.detectAreaCovered(
      ENG,
      [
        row('A.6', 'A.6.2.5', 'evidenced'),
        row('A.6', 'A.6.2.8', 'untouched', false),
      ],
      NOW,
    );
    expect(out).toHaveLength(1);
  });

  it('emits one signal per area that is covered', () => {
    const out = det.detectAreaCovered(
      ENG,
      [
        row('A.6', 'A.6.2.5', 'evidenced'),
        row('A.7', 'A.7.4', 'evidenced'),
      ],
      NOW,
    );
    expect(out).toHaveLength(2);
    expect(out.map((s) => s.areaId).sort()).toEqual(['A.6', 'A.7']);
  });

  it('skips empty buckets', () => {
    const out = det.detectAreaCovered(ENG, [], NOW);
    expect(out).toHaveLength(0);
  });
});

describe('TerminationDetector.detectEngagement — Audit Mode', () => {
  it('emits auditTerminationReady when scope covered AND all candidates reviewed', () => {
    const out = det.detectEngagement({
      engagementId: ENG,
      mode: 'audit',
      clauseRows: [
        row('A.6', 'A.6.2.5', 'evidenced'),
        row('A.6', 'A.6.2.8', 'na'),
      ],
      candidateFindings: [
        { id: 'cf1', decided: true },
        { id: 'cf2', decided: true },
      ],
      now: NOW,
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.kind).toBe('auditTerminationReady');
  });

  it('does not emit when any candidate finding is undecided', () => {
    const out = det.detectEngagement({
      engagementId: ENG,
      mode: 'audit',
      clauseRows: [row('A.6', 'A.6.2.5', 'evidenced')],
      candidateFindings: [{ id: 'cf1', decided: false }],
      now: NOW,
    });
    expect(out).toHaveLength(0);
  });

  it('does not emit when scope is not covered', () => {
    const out = det.detectEngagement({
      engagementId: ENG,
      mode: 'audit',
      clauseRows: [row('A.6', 'A.6.2.5', 'untouched')],
      candidateFindings: [{ id: 'cf1', decided: true }],
      now: NOW,
    });
    expect(out).toHaveLength(0);
  });

  it('emits when there are zero candidate findings', () => {
    const out = det.detectEngagement({
      engagementId: ENG,
      mode: 'audit',
      clauseRows: [row('A.6', 'A.6.2.5', 'evidenced')],
      candidateFindings: [],
      now: NOW,
    });
    expect(out).toHaveLength(1);
  });
});

describe('TerminationDetector.detectEngagement — Readiness Mode', () => {
  it('emits readinessTerminationReady when all evidenced AND all candidates closed', () => {
    const out = det.detectEngagement({
      engagementId: ENG,
      mode: 'readiness',
      clauseRows: [
        row('A.6', 'A.6.2.5', 'evidenced'),
        row('A.7', 'A.7.4', 'evidenced'),
      ],
      candidateFindings: [
        { id: 'cf1', closed: true },
        { id: 'cf2', closed: true },
      ],
      now: NOW,
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.kind).toBe('readinessTerminationReady');
  });

  it('readiness mode rejects N/A statuses (must be evidenced)', () => {
    const out = det.detectEngagement({
      engagementId: ENG,
      mode: 'readiness',
      clauseRows: [
        row('A.6', 'A.6.2.5', 'evidenced'),
        row('A.6', 'A.6.2.8', 'na'),
      ],
      candidateFindings: [],
      now: NOW,
    });
    expect(out).toHaveLength(0);
  });

  it('does not emit when any candidate finding is still open (not closed)', () => {
    const out = det.detectEngagement({
      engagementId: ENG,
      mode: 'readiness',
      clauseRows: [row('A.6', 'A.6.2.5', 'evidenced')],
      candidateFindings: [{ id: 'cf1', closed: false }],
      now: NOW,
    });
    expect(out).toHaveLength(0);
  });

  it('does not emit on an empty in-scope set if there is any partial status', () => {
    const out = det.detectEngagement({
      engagementId: ENG,
      mode: 'readiness',
      clauseRows: [row('A.6', 'A.6.2.5', 'partial')],
      candidateFindings: [],
      now: NOW,
    });
    expect(out).toHaveLength(0);
  });
});
