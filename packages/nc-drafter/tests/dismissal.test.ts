// SPDX-License-Identifier: BUSL-1.1
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildDismissalDecision,
  buildParkDecision,
  buildPromotionDecision,
  DismissalReasonSchema,
} from '../src/index.js';

const idGen = () => randomUUID();
const at = '2026-05-03T11:00:00.000Z';

describe('DismissalReason', () => {
  it('accepts canonical codes without note', () => {
    expect(DismissalReasonSchema.safeParse({ code: 'false_positive' }).success).toBe(true);
    expect(DismissalReasonSchema.safeParse({ code: 'not_in_scope' }).success).toBe(true);
    expect(DismissalReasonSchema.safeParse({ code: 'duplicate' }).success).toBe(true);
  });

  it('requires a non-empty note when code is "other"', () => {
    expect(DismissalReasonSchema.safeParse({ code: 'other' }).success).toBe(false);
    expect(DismissalReasonSchema.safeParse({ code: 'other', note: '   ' }).success).toBe(false);
    const ok = DismissalReasonSchema.safeParse({ code: 'other', note: 'duplicate of NC-001' });
    expect(ok.success).toBe(true);
  });

  it('rejects unknown codes', () => {
    expect(
      DismissalReasonSchema.safeParse({ code: 'whatever' }).success,
    ).toBe(false);
  });
});

describe('buildDismissalDecision', () => {
  const candidateId = '00000000-0000-4000-8000-000000000001';
  const actor = '00000000-0000-4000-8000-000000000bbb';

  it('builds a dismiss row', () => {
    const decision = buildDismissalDecision({
      candidateFindingId: candidateId,
      actor,
      at,
      reason: { code: 'false_positive' },
      idGen,
    });
    expect(decision.action).toBe('dismiss');
    expect(decision.candidateFindingId).toBe(candidateId);
    expect(decision.dismissalReason?.code).toBe('false_positive');
    expect(decision.promotedFindingId).toBeNull();
  });

  it('throws if reason "other" lacks free text', () => {
    expect(() =>
      buildDismissalDecision({
        candidateFindingId: candidateId,
        actor,
        at,
        reason: { code: 'other' } as never,
        idGen,
      }),
    ).toThrow(/Invalid dismissal reason/);
  });

  it('accepts reason "other" with free text', () => {
    const decision = buildDismissalDecision({
      candidateFindingId: candidateId,
      actor,
      at,
      reason: { code: 'other', note: 'auditor escalation per LAA' },
      idGen,
      notes: 'discussion captured in WP-007',
    });
    expect(decision.dismissalReason?.code).toBe('other');
    expect(decision.dismissalReason?.note).toBe('auditor escalation per LAA');
    expect(decision.notes).toBe('discussion captured in WP-007');
  });
});

describe('buildPromotionDecision / buildParkDecision', () => {
  const candidateId = '00000000-0000-4000-8000-000000000001';
  const actor = '00000000-0000-4000-8000-000000000bbb';
  const findingId = '00000000-0000-4000-8000-000000000ccc';

  it('promotion decision carries the new finding ID', () => {
    const d = buildPromotionDecision({
      candidateFindingId: candidateId,
      actor,
      at,
      promotedFindingId: findingId,
      idGen,
    });
    expect(d.action).toBe('promote');
    expect(d.promotedFindingId).toBe(findingId);
    expect(d.dismissalReason).toBeNull();
  });

  it('park decision has no dismissal or promotion data', () => {
    const d = buildParkDecision({
      candidateFindingId: candidateId,
      actor,
      at,
      idGen,
      notes: 'revisit at end of audit',
    });
    expect(d.action).toBe('park');
    expect(d.dismissalReason).toBeNull();
    expect(d.promotedFindingId).toBeNull();
    expect(d.notes).toBe('revisit at end of audit');
  });
});
