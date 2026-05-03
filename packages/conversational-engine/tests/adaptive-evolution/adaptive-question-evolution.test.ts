// SPDX-License-Identifier: BUSL-1.1
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  AdaptiveQuestionEvolution,
  type AdaptiveClaim,
  type AttributionConfirmedEvent,
  type CoverageMap,
  type FollowupTemplate,
  type QueuedQuestion,
} from '../../src/adaptive-evolution/adaptive-index.js';

const ENG = '11111111-1111-4111-8111-111111111111';

class StubFollowupLibrary {
  templates = new Map<string, FollowupTemplate[]>();
  set(shape: string, ts: FollowupTemplate[]): void {
    this.templates.set(shape, ts);
  }
  findByShape(shape: string): readonly FollowupTemplate[] {
    return this.templates.get(shape) ?? [];
  }
}

function q(
  text: string,
  targetClauses: string[],
  priority: number,
  pinned = false,
): QueuedQuestion {
  return {
    id: randomUUID(),
    libraryQuestionId: 'lib_x',
    kind: 'library',
    text,
    targetClauses,
    priority,
    sourceClaimId: null,
    shape: null,
    pinned,
  };
}

function makeClaim(
  attrs: Array<{ clauseId: string; confidence: number }>,
  overrides: Partial<AdaptiveClaim> = {},
): AdaptiveClaim {
  return {
    id: 'claim_1',
    text: 'sample claim',
    capturedAt: '2026-05-03T10:00:00.000Z',
    attributions: attrs.map((a) => ({
      clauseId: a.clauseId,
      controlId: null,
      confidence: a.confidence,
    })),
    contradicts: null,
    shape: null,
    ...overrides,
  };
}

function makeEvent(claim: AdaptiveClaim): AttributionConfirmedEvent {
  return { engagementId: ENG, claim, at: '2026-05-03T10:00:00.000Z' };
}

describe('AdaptiveQuestionEvolution.applyCoverageDelta', () => {
  it('drops priority of newly-attributed clauses', () => {
    const ev = new AdaptiveQuestionEvolution({
      followupLibrary: new StubFollowupLibrary(),
    });
    const queue = [q('Q-A', ['A.6.2.5'], 0.8), q('Q-B', ['A.7.4'], 0.5)];
    const out = ev.applyCoverageDelta(
      queue,
      makeClaim([{ clauseId: 'A.6.2.5', confidence: 0.92 }]),
      { 'A.6.2.5': 'evidenced', 'A.7.4': 'untouched' },
    );
    const a = out.find((x) => x.text === 'Q-A')!;
    expect(a.priority).toBeLessThan(0.8);
    const b = out.find((x) => x.text === 'Q-B')!;
    expect(b.priority).toBeGreaterThanOrEqual(0.5);
  });

  it('raises untouched-clause priority by 15%', () => {
    const ev = new AdaptiveQuestionEvolution({
      followupLibrary: new StubFollowupLibrary(),
    });
    const queue = [q('Q', ['A.7.4'], 0.6)];
    const out = ev.applyCoverageDelta(queue, makeClaim([]), {
      'A.7.4': 'untouched',
    });
    expect(out[0]!.priority).toBeCloseTo(0.6 * 1.15, 6);
  });

  it('does not change pinned questions', () => {
    const ev = new AdaptiveQuestionEvolution({
      followupLibrary: new StubFollowupLibrary(),
    });
    const queue = [q('Q', ['A.6.2.5'], 0.4, true)];
    const out = ev.applyCoverageDelta(
      queue,
      makeClaim([{ clauseId: 'A.6.2.5', confidence: 0.95 }]),
      { 'A.6.2.5': 'evidenced' },
    );
    expect(out[0]!.priority).toBe(0.4);
  });

  it('sorts result descending by priority', () => {
    const ev = new AdaptiveQuestionEvolution({
      followupLibrary: new StubFollowupLibrary(),
    });
    const queue = [q('A', ['x'], 0.2), q('B', ['y'], 0.9), q('C', ['z'], 0.5)];
    const out = ev.applyCoverageDelta(queue, makeClaim([]), {});
    expect(out.map((x) => x.text)).toEqual(['B', 'C', 'A']);
  });

  it('clamps priority into [0,1]', () => {
    const ev = new AdaptiveQuestionEvolution({
      followupLibrary: new StubFollowupLibrary(),
    });
    const queue = [q('Q', ['A.7.4'], 0.95)];
    const out = ev.applyCoverageDelta(queue, makeClaim([]), {
      'A.7.4': 'untouched',
    });
    // 0.95 * 1.15 = 1.0925 → clamped to 1
    expect(out[0]!.priority).toBeLessThanOrEqual(1);
  });

  it('ignores attributions below the high-confidence threshold', () => {
    const ev = new AdaptiveQuestionEvolution({
      followupLibrary: new StubFollowupLibrary(),
    });
    const queue = [q('Q', ['A.6.2.5'], 0.6)];
    const out = ev.applyCoverageDelta(
      queue,
      makeClaim([{ clauseId: 'A.6.2.5', confidence: 0.5 }]),
      {},
    );
    expect(out[0]!.priority).toBe(0.6);
  });
});

describe('AdaptiveQuestionEvolution.maybeInjectContradiction', () => {
  it('drafts a contradiction-resolution question when claim contradicts an earlier one', () => {
    const ev = new AdaptiveQuestionEvolution({
      followupLibrary: new StubFollowupLibrary(),
    });
    const claim = makeClaim([], {
      contradicts: { earlierClaimId: 'c0', contradictedClause: '6.1.2' },
    });
    const out = ev.maybeInjectContradiction(claim);
    expect(out).not.toBeNull();
    expect(out!.kind).toBe('contradiction_resolution');
    expect(out!.priority).toBeGreaterThanOrEqual(0.95);
    expect(out!.targetClauses).toEqual(['6.1.2']);
    expect(out!.text).toMatch(/6\.1\.2/);
  });

  it('returns null when there is no contradiction', () => {
    const ev = new AdaptiveQuestionEvolution({
      followupLibrary: new StubFollowupLibrary(),
    });
    expect(ev.maybeInjectContradiction(makeClaim([]))).toBeNull();
  });
});

describe('AdaptiveQuestionEvolution.injectFollowups', () => {
  it('emits follow-ups for matched shape on high-conf attribution', () => {
    const lib = new StubFollowupLibrary();
    lib.set('process_exists', [
      {
        id: 'fu1',
        shape: 'process_exists',
        text: 'Show me when it was last executed.',
        targetClauses: ['A.6.2.5'],
      },
      {
        id: 'fu2',
        shape: 'process_exists',
        text: 'Who owns the procedure?',
        targetClauses: ['A.6.2.5'],
      },
    ]);
    const ev = new AdaptiveQuestionEvolution({ followupLibrary: lib });
    const claim = makeClaim([{ clauseId: 'A.6.2.5', confidence: 0.9 }], {
      shape: 'process_exists',
    });
    const out = ev.injectFollowups(claim);
    expect(out).toHaveLength(2);
    expect(out[0]!.kind).toBe('follow_up');
    expect(out[0]!.libraryQuestionId).toBe('fu1');
    expect(out[1]!.priority).toBeLessThan(out[0]!.priority);
  });

  it('does not emit follow-ups for low-confidence attribution', () => {
    const lib = new StubFollowupLibrary();
    lib.set('x', [
      { id: 'fu1', shape: 'x', text: 't', targetClauses: ['A.6.2.5'] },
    ]);
    const ev = new AdaptiveQuestionEvolution({ followupLibrary: lib });
    const claim = makeClaim([{ clauseId: 'A.6.2.5', confidence: 0.5 }], {
      shape: 'x',
    });
    expect(ev.injectFollowups(claim)).toEqual([]);
  });

  it('does not emit follow-ups when claim has no shape tag', () => {
    const lib = new StubFollowupLibrary();
    lib.set('x', [
      { id: 'fu1', shape: 'x', text: 't', targetClauses: ['A.6.2.5'] },
    ]);
    const ev = new AdaptiveQuestionEvolution({ followupLibrary: lib });
    const claim = makeClaim([{ clauseId: 'A.6.2.5', confidence: 0.95 }]);
    expect(ev.injectFollowups(claim)).toEqual([]);
  });
});

describe('AdaptiveQuestionEvolution.apply (synthetic engagement reflow)', () => {
  it('runs all three reflow steps and returns AdaptiveQueueState', () => {
    const lib = new StubFollowupLibrary();
    lib.set('process_exists', [
      {
        id: 'fu1',
        shape: 'process_exists',
        text: 'Show me when it was last executed.',
        targetClauses: ['A.6.2.5'],
      },
    ]);
    const ev = new AdaptiveQuestionEvolution({ followupLibrary: lib });
    const queue = [q('Q-A', ['A.6.2.5'], 0.8), q('Q-B', ['A.7.4'], 0.5)];
    const coverage: CoverageMap = {
      'A.6.2.5': 'evidenced',
      'A.7.4': 'untouched',
    };
    const claim = makeClaim([{ clauseId: 'A.6.2.5', confidence: 0.95 }], {
      shape: 'process_exists',
      contradicts: { earlierClaimId: 'c0', contradictedClause: 'A.6.2.5' },
    });
    const out = ev.apply(queue, makeEvent(claim), coverage);
    expect(out.reorderedQuestions).toHaveLength(2);
    expect(out.injectedQuestions).toHaveLength(2);
    expect(out.injectedQuestions.some((x) => x.kind === 'contradiction_resolution')).toBe(
      true,
    );
    expect(out.injectedQuestions.some((x) => x.kind === 'follow_up')).toBe(true);
  });
});
