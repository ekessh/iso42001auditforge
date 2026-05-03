// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import {
  applyTransition,
  canTransition,
  SoaReviewer,
} from '../src/reviewer.js';
import type { SoaRecord } from '../src/domain.js';
import {
  ENGAGEMENT_ID,
  FIRM_ID,
  REVIEWER_ID,
  fixedNow,
  makeIdFactory,
} from './fixtures.js';

function makeRecord(controlId: string): SoaRecord {
  return {
    id: '00000000-0000-4000-8000-00000000aaaa',
    firmId: FIRM_ID,
    engagementId: ENGAGEMENT_ID,
    controlId,
    applicability: 'applicable',
    importedAt: '2026-05-03T12:00:00.000Z',
  };
}

function makeReviewer(): SoaReviewer {
  return new SoaReviewer({ newId: makeIdFactory(), now: fixedNow });
}

describe('state machine - applyTransition', () => {
  it('confirms a pending review', () => {
    expect(applyTransition('pending', 'confirm')).toBe('confirmed');
  });

  it('disputes a pending review', () => {
    expect(applyTransition('pending', 'dispute')).toBe('disputed');
  });

  it('raises NC from pending', () => {
    expect(applyTransition('pending', 'raise_nc')).toBe('nc_raised');
  });

  it('marks NA from pending', () => {
    expect(applyTransition('pending', 'na')).toBe('na');
  });

  it('idempotent confirm on confirmed', () => {
    expect(applyTransition('confirmed', 'confirm')).toBe('confirmed');
  });

  it('escalates confirmed -> disputed -> nc_raised', () => {
    const a = applyTransition('confirmed', 'dispute');
    const b = applyTransition(a, 'raise_nc');
    expect(a).toBe('disputed');
    expect(b).toBe('nc_raised');
  });

  it('withdraws nc_raised back to disputed', () => {
    expect(applyTransition('nc_raised', 'withdraw')).toBe('disputed');
  });

  it('rejects illegal transitions with StateMachineError', () => {
    expect(() => applyTransition('na', 'confirm')).toThrow(/STATE_TRANSITION_INVALID|Invalid state/);
  });

  it('rejects withdrawing a non-NC review', () => {
    expect(() => applyTransition('confirmed', 'withdraw')).toThrow();
  });

  it('rejects raising NC after withdraw to pending', () => {
    expect(canTransition('disputed', 'withdraw')).toBe(true);
    const back = applyTransition('disputed', 'withdraw');
    expect(back).toBe('pending');
    expect(canTransition('pending', 'raise_nc')).toBe(true);
  });

  it('NA can be disputed (auditor reverses)', () => {
    expect(applyTransition('na', 'dispute')).toBe('disputed');
  });
});

describe('SoaReviewer.apply', () => {
  it('builds an initial review with verdict pending', () => {
    const reviewer = makeReviewer();
    const review = reviewer.initialReview(makeRecord('A.5.4'), REVIEWER_ID);
    expect(review.verdict).toBe('pending');
    expect(review.controlId).toBe('A.5.4');
    expect(review.reviewerId).toBe(REVIEWER_ID);
  });

  it('applies a confirm action', () => {
    const reviewer = makeReviewer();
    const initial = reviewer.initialReview(makeRecord('A.5.4'), REVIEWER_ID);
    const next = reviewer.apply(initial, { action: 'confirm', reviewerId: REVIEWER_ID });
    expect(next.verdict).toBe('confirmed');
  });

  it('rejects dispute without rationale', () => {
    const reviewer = makeReviewer();
    const initial = reviewer.initialReview(makeRecord('A.5.4'), REVIEWER_ID);
    expect(() => reviewer.apply(initial, { action: 'dispute', reviewerId: REVIEWER_ID })).toThrow(
      /rationale/,
    );
  });

  it('accepts dispute with rationale', () => {
    const reviewer = makeReviewer();
    const initial = reviewer.initialReview(makeRecord('A.5.4'), REVIEWER_ID);
    const next = reviewer.apply(initial, {
      action: 'dispute',
      reviewerId: REVIEWER_ID,
      rationale: 'evidence does not match claim',
    });
    expect(next.verdict).toBe('disputed');
    expect(next.rationale).toContain('evidence');
  });

  it('attaches findingId on raise_nc', () => {
    const reviewer = makeReviewer();
    const initial = reviewer.initialReview(makeRecord('A.5.4'), REVIEWER_ID);
    const next = reviewer.apply(initial, {
      action: 'raise_nc',
      reviewerId: REVIEWER_ID,
      rationale: 'control not implemented in production',
      findingId: '00000000-0000-4000-8000-000000000099',
    });
    expect(next.verdict).toBe('nc_raised');
    expect(next.findingId).toBe('00000000-0000-4000-8000-000000000099');
  });

  it('strips findingId on withdraw', () => {
    const reviewer = makeReviewer();
    const initial = reviewer.initialReview(makeRecord('A.5.4'), REVIEWER_ID);
    const nc = reviewer.apply(initial, {
      action: 'raise_nc',
      reviewerId: REVIEWER_ID,
      rationale: 'temp',
      findingId: '00000000-0000-4000-8000-000000000099',
    });
    const withdrawn = reviewer.apply(nc, { action: 'withdraw', reviewerId: REVIEWER_ID });
    expect(withdrawn.verdict).toBe('disputed');
    expect(withdrawn.findingId).toBeUndefined();
  });

  it('does not mutate the original review', () => {
    const reviewer = makeReviewer();
    const initial = reviewer.initialReview(makeRecord('A.5.4'), REVIEWER_ID);
    const before = JSON.stringify(initial);
    reviewer.apply(initial, { action: 'confirm', reviewerId: REVIEWER_ID });
    expect(JSON.stringify(initial)).toBe(before);
  });
});

describe('SoaReviewer.batch helpers', () => {
  it('batch-confirms only pending reviews', () => {
    const reviewer = makeReviewer();
    const r1 = reviewer.initialReview(makeRecord('A.5.4'), REVIEWER_ID);
    const r2 = reviewer.initialReview(makeRecord('A.5.5'), REVIEWER_ID);
    const r2Confirmed = reviewer.apply(r2, { action: 'confirm', reviewerId: REVIEWER_ID });
    const result = reviewer.batchConfirm([r1, r2Confirmed], REVIEWER_ID);
    expect(result.confirmed).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
  });

  it('batchRaiseNc skips records that fail predicate', () => {
    const reviewer = makeReviewer();
    const r1 = reviewer.initialReview(makeRecord('A.5.4'), REVIEWER_ID);
    const r2 = reviewer.initialReview(makeRecord('A.7.4'), REVIEWER_ID);
    const result = reviewer.batchRaiseNc([r1, r2], REVIEWER_ID, 'systemic gap', (r) =>
      r.controlId.startsWith('A.5'),
    );
    expect(result.ncRaised).toHaveLength(1);
    expect(result.ncRaised[0]?.controlId).toBe('A.5.4');
    expect(result.skipped).toHaveLength(1);
  });

  it('batchRaiseNc requires rationale', () => {
    const reviewer = makeReviewer();
    const r1 = reviewer.initialReview(makeRecord('A.5.4'), REVIEWER_ID);
    expect(() => reviewer.batchRaiseNc([r1], REVIEWER_ID, '', () => true)).toThrow();
  });
});
