// SPDX-License-Identifier: BUSL-1.1
import { StateMachineError, ValidationError } from '@auditforge/shared';
import {
  type SoaRecord,
  type SoaReview,
  type SoaReviewAction,
  type SoaReviewVerdict,
} from './domain.js';

/**
 * Allowed transitions for SoA review verdicts. Implemented as a sparse
 * adjacency map so the state machine is easy to read at review time.
 */
const TRANSITIONS: Record<SoaReviewVerdict, Partial<Record<SoaReviewAction, SoaReviewVerdict>>> = {
  pending: {
    confirm: 'confirmed',
    dispute: 'disputed',
    raise_nc: 'nc_raised',
    na: 'na',
  },
  confirmed: {
    confirm: 'confirmed', // idempotent
    dispute: 'disputed',
    raise_nc: 'nc_raised',
  },
  disputed: {
    confirm: 'confirmed',
    raise_nc: 'nc_raised',
    withdraw: 'pending',
  },
  nc_raised: {
    withdraw: 'disputed',
  },
  na: {
    dispute: 'disputed',
  },
};

/**
 * Pure state-machine step. Throws `StateMachineError` for any illegal
 * transition - callers may catch and translate to HTTP 409.
 */
export function applyTransition(
  current: SoaReviewVerdict,
  action: SoaReviewAction,
): SoaReviewVerdict {
  const next = TRANSITIONS[current][action];
  if (next === undefined) {
    throw new StateMachineError(current, action);
  }
  return next;
}

export function canTransition(
  current: SoaReviewVerdict,
  action: SoaReviewAction,
): boolean {
  return TRANSITIONS[current][action] !== undefined;
}

export interface ReviewActionInput {
  action: SoaReviewAction;
  rationale?: string;
  findingId?: string;
  reviewerId: string;
  /** ISO timestamp; default: now. */
  at?: string;
  confidence?: number;
}

export interface SoaReviewerDeps {
  newId: () => string;
  now?: () => string;
}

/**
 * Domain service that owns SoA review verdicts. Stateless across calls;
 * persistence is the caller's responsibility (returns the new review object
 * which the application can store).
 */
export class SoaReviewer {
  private readonly deps: Required<Pick<SoaReviewerDeps, 'newId'>> &
    Pick<SoaReviewerDeps, 'now'>;

  constructor(deps: SoaReviewerDeps) {
    this.deps = { newId: deps.newId, ...(deps.now !== undefined ? { now: deps.now } : {}) };
  }

  private nowIso(): string {
    return (this.deps.now ?? (() => new Date().toISOString()))();
  }

  /**
   * Create a fresh review (verdict = pending) for an SoA record.
   */
  initialReview(record: SoaRecord, reviewerId: string): SoaReview {
    return {
      id: this.deps.newId(),
      firmId: record.firmId,
      engagementId: record.engagementId,
      soaRecordId: record.id,
      controlId: record.controlId,
      verdict: 'pending',
      reviewerId,
      reviewedAt: this.nowIso(),
      confidence: 80,
    };
  }

  /**
   * Apply an action to an existing review. Returns the new review record;
   * does NOT mutate the input.
   */
  apply(review: SoaReview, input: ReviewActionInput): SoaReview {
    const nextVerdict = applyTransition(review.verdict, input.action);

    if (
      (input.action === 'dispute' || input.action === 'raise_nc') &&
      (input.rationale === undefined || input.rationale.trim() === '')
    ) {
      throw new ValidationError('rationale is required for dispute / raise_nc', {
        action: input.action,
      });
    }

    const next: SoaReview = {
      ...review,
      verdict: nextVerdict,
      reviewerId: input.reviewerId,
      reviewedAt: input.at ?? this.nowIso(),
      ...(input.confidence !== undefined ? { confidence: input.confidence } : {}),
      ...(input.rationale !== undefined ? { rationale: input.rationale } : {}),
      ...(input.findingId !== undefined ? { findingId: input.findingId } : {}),
    };
    if (input.action === 'withdraw') {
      // remove findingId on withdraw
      delete (next as { findingId?: string }).findingId;
    }
    return next;
  }

  /**
   * Bulk-confirm helper - confirms every still-pending review in the input
   * set. Records that are not in `pending` are skipped silently and reported
   * in `skipped`.
   */
  batchConfirm(
    reviews: SoaReview[],
    reviewerId: string,
    at?: string,
  ): { confirmed: SoaReview[]; skipped: SoaReview[] } {
    const confirmed: SoaReview[] = [];
    const skipped: SoaReview[] = [];
    for (const r of reviews) {
      if (r.verdict !== 'pending') {
        skipped.push(r);
        continue;
      }
      confirmed.push(
        this.apply(r, {
          action: 'confirm',
          reviewerId,
          ...(at !== undefined ? { at } : {}),
        }),
      );
    }
    return { confirmed, skipped };
  }

  /**
   * Bulk-NC helper - raises a non-conformity on every record matching a
   * predicate. Useful for "raise NC on all controls in category X with
   * weak justification".
   */
  batchRaiseNc(
    reviews: SoaReview[],
    reviewerId: string,
    rationale: string,
    predicate: (r: SoaReview) => boolean,
  ): { ncRaised: SoaReview[]; skipped: SoaReview[] } {
    if (rationale.trim() === '') {
      throw new ValidationError('batchRaiseNc rationale required');
    }
    const ncRaised: SoaReview[] = [];
    const skipped: SoaReview[] = [];
    for (const r of reviews) {
      if (!predicate(r) || !canTransition(r.verdict, 'raise_nc')) {
        skipped.push(r);
        continue;
      }
      ncRaised.push(this.apply(r, { action: 'raise_nc', reviewerId, rationale }));
    }
    return { ncRaised, skipped };
  }
}
