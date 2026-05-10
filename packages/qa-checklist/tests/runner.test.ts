// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { ChecklistRunner } from '../src/runner/runner.js';
import type { QaChecklistLedgerEvent } from '../src/domain/events.js';
import {
  ctxBuilder,
  dismissedCandidate,
  findingWithEvidence,
  findingWithoutEvidence,
  openCandidate,
} from './helpers.js';

const ACTOR = '00000000-0000-0000-0000-00000000fa00';

function ledger() {
  const events: QaChecklistLedgerEvent[] = [];
  return {
    emit(e: QaChecklistLedgerEvent) {
      events.push(e);
    },
    events,
  };
}

describe('ChecklistRunner', () => {
  it('passes when every check is satisfied', () => {
    const r = new ChecklistRunner().evaluate({ ctx: ctxBuilder(), actorId: ACTOR });
    expect(r.passed).toBe(true);
    expect(r.items.every((i) => i.status === 'pass' || i.status === 'skipped')).toBe(true);
  });

  it('fails when scope is too short', () => {
    const ctx = ctxBuilder({
      draft: {
        ...ctxBuilder().draft,
        scopeStatement: 'short',
      },
    });
    const r = new ChecklistRunner().evaluate({ ctx, actorId: ACTOR });
    expect(r.passed).toBe(false);
    expect(r.items.find((i) => i.id === 'scope-statement')?.status).toBe('fail');
  });

  it('fails when methodology is missing', () => {
    const ctx = ctxBuilder({ draft: { ...ctxBuilder().draft, methodologyStatement: '' } });
    const r = new ChecklistRunner().evaluate({ ctx, actorId: ACTOR });
    expect(r.passed).toBe(false);
    expect(r.items.find((i) => i.id === 'methodology-section')?.status).toBe('fail');
  });

  it('fails when findings have no evidence', () => {
    const ctx = ctxBuilder({ findings: [findingWithoutEvidence(), findingWithEvidence()] });
    const r = new ChecklistRunner().evaluate({ ctx, actorId: ACTOR });
    expect(r.passed).toBe(false);
    expect(r.items.find((i) => i.id === 'findings-have-evidence')?.status).toBe('fail');
  });

  it('passes when every finding has evidence', () => {
    const ctx = ctxBuilder({ findings: [findingWithEvidence(), findingWithEvidence()] });
    const r = new ChecklistRunner().evaluate({ ctx, actorId: ACTOR });
    expect(r.items.find((i) => i.id === 'findings-have-evidence')?.status).toBe('pass');
  });

  it('fails when candidate findings are still open', () => {
    const ctx = ctxBuilder({ candidateFindings: [openCandidate(), dismissedCandidate()] });
    const r = new ChecklistRunner().evaluate({ ctx, actorId: ACTOR });
    expect(r.passed).toBe(false);
    expect(r.items.find((i) => i.id === 'candidate-findings-resolved')?.status).toBe('fail');
  });

  it('fails when peer review is not approved', () => {
    const base = ctxBuilder();
    const ctx = ctxBuilder({
      peerReview: { ...base.peerReview, status: 'in_review', approvedAt: undefined },
    });
    const r = new ChecklistRunner().evaluate({ ctx, actorId: ACTOR });
    expect(r.items.find((i) => i.id === 'peer-review-approved')?.status).toBe('fail');
  });

  it('skips peer review check when not required', () => {
    const base = ctxBuilder();
    const ctx = ctxBuilder({
      peerReview: { ...base.peerReview, required: false, status: undefined, approvedAt: undefined },
    });
    const r = new ChecklistRunner().evaluate({ ctx, actorId: ACTOR });
    expect(r.items.find((i) => i.id === 'peer-review-approved')?.status).toBe('skipped');
  });

  it('requires a security reviewer when scope demands it', () => {
    const base = ctxBuilder();
    const ctx = ctxBuilder({
      peerReview: { ...base.peerReview, securityReviewRequired: true },
    });
    const r = new ChecklistRunner().evaluate({ ctx, actorId: ACTOR });
    expect(r.items.find((i) => i.id === 'security-review-approved')?.status).toBe('fail');
  });

  it('passes when security reviewer approved', () => {
    const base = ctxBuilder();
    const ctx = ctxBuilder({
      peerReview: {
        ...base.peerReview,
        securityReviewRequired: true,
        securityReviewerId: '00000000-0000-0000-0000-000000000007',
        securityApprovedAt: '2026-05-02T00:00:00Z',
      },
    });
    const r = new ChecklistRunner().evaluate({ ctx, actorId: ACTOR });
    expect(r.items.find((i) => i.id === 'security-review-approved')?.status).toBe('pass');
  });

  it('fails when sampling plan absent', () => {
    const ctx = ctxBuilder({ samplingPlan: undefined });
    const r = new ChecklistRunner().evaluate({ ctx, actorId: ACTOR });
    expect(r.items.find((i) => i.id === 'sampling-plan-documented')?.status).toBe('fail');
  });

  it('fails when impartiality undeclared', () => {
    const ctx = ctxBuilder({ impartiality: { declared: false } });
    const r = new ChecklistRunner().evaluate({ ctx, actorId: ACTOR });
    expect(r.items.find((i) => i.id === 'impartiality-declared')?.status).toBe('fail');
  });

  it('fails when signing key absent', () => {
    const base = ctxBuilder();
    const ctx = ctxBuilder({ signing: { ...base.signing, signingKeyId: undefined } });
    const r = new ChecklistRunner().evaluate({ ctx, actorId: ACTOR });
    expect(r.items.find((i) => i.id === 'signing-key-recorded')?.status).toBe('fail');
  });

  it('fails when TSA anchor missing', () => {
    const base = ctxBuilder();
    const ctx = ctxBuilder({ signing: { ...base.signing, tsaAnchorId: undefined } });
    const r = new ChecklistRunner().evaluate({ ctx, actorId: ACTOR });
    expect(r.items.find((i) => i.id === 'tsa-anchor-present')?.status).toBe('fail');
  });

  it('requires the readiness disclaimer in readiness mode', () => {
    const ctx = ctxBuilder({ mode: 'readiness' });
    const r = new ChecklistRunner().evaluate({ ctx, actorId: ACTOR });
    expect(r.items.find((i) => i.id === 'readiness-disclaimer')?.status).toBe('fail');
  });

  it('passes when readiness disclaimer present', () => {
    const base = ctxBuilder();
    const ctx = ctxBuilder({
      mode: 'readiness',
      draft: { ...base.draft, hasMandatoryDisclaimer: true },
    });
    const r = new ChecklistRunner().evaluate({ ctx, actorId: ACTOR });
    expect(r.items.find((i) => i.id === 'readiness-disclaimer')?.status).toBe('pass');
  });

  it('overrides a failed check when rationale provided', () => {
    const ctx = ctxBuilder({
      samplingPlan: undefined,
      overrides: {
        'sampling-plan-documented': {
          actorId: '00000000-0000-0000-0000-000000000010',
          rationale: 'Witnessed audit; sampling not applicable to this engagement segment.',
          at: '2026-05-03T00:00:00Z',
        },
      },
    });
    const l = ledger();
    const r = new ChecklistRunner({ ledger: l }).evaluate({ ctx, actorId: ACTOR });
    expect(r.passed).toBe(true);
    const item = r.items.find((i) => i.id === 'sampling-plan-documented');
    expect(item?.status).toBe('overridden');
    expect(item?.overrideRationale?.length ?? 0).toBeGreaterThan(0);
    expect(l.events.some((e) => e.kind === 'qa_checklist.overridden')).toBe(true);
    expect(l.events.some((e) => e.kind === 'qa_checklist.evaluated')).toBe(true);
  });

  it('rejects empty override rationale', () => {
    const ctx = ctxBuilder({
      samplingPlan: undefined,
      overrides: {
        'sampling-plan-documented': {
          actorId: '00000000-0000-0000-0000-000000000010',
          rationale: '   ',
          at: '2026-05-03T00:00:00Z',
        },
      },
    });
    expect(() =>
      new ChecklistRunner().evaluate({ ctx, actorId: ACTOR }),
    ).toThrowError(/Override rationale/);
  });

  it('emits an evaluated ledger event with failed item ids', () => {
    const ctx = ctxBuilder({ samplingPlan: undefined, impartiality: { declared: false } });
    const l = ledger();
    new ChecklistRunner({ ledger: l }).evaluate({ ctx, actorId: ACTOR });
    const e = l.events.find((x) => x.kind === 'qa_checklist.evaluated');
    expect(e).toBeTruthy();
    if (e && e.kind === 'qa_checklist.evaluated') {
      expect(e.passed).toBe(false);
      expect(e.failedItemIds).toContain('sampling-plan-documented');
      expect(e.failedItemIds).toContain('impartiality-declared');
    }
  });

  it('assertPasses throws on failure', () => {
    const ctx = ctxBuilder({ samplingPlan: undefined });
    expect(() =>
      new ChecklistRunner().assertPasses({ ctx, actorId: ACTOR }),
    ).toThrowError(/QA checklist/);
  });

  it('assertPasses returns result on success', () => {
    const r = new ChecklistRunner().assertPasses({ ctx: ctxBuilder(), actorId: ACTOR });
    expect(r.passed).toBe(true);
  });

  it('rejects empty checks list', () => {
    expect(() => new ChecklistRunner({ checks: [] })).toThrowError();
  });
});
