// SPDX-License-Identifier: BUSL-1.1
import { ValidationError } from '@auditforge/shared';
import type { PeerReviewChecklist, QualityChecklistItem } from '../domain/checklist.js';
import type { PeerReviewRequest } from '../domain/request.js';
import type { ItemResponse } from '../domain/enums.js';

export interface QualityAggregate {
  /** Items not marked NA. */
  readonly answered: number;
  readonly passed: number;
  readonly failed: number;
  readonly skippedNa: number;
  readonly total: number;
  /** passed / answered (0 if answered === 0). 0..1 fraction. */
  readonly passRate: number;
  /** failed / answered. 0..1. */
  readonly failRate: number;
  /** skippedNa / total. 0..1. */
  readonly naRate: number;
  /**
   * Weighted score = sum(weight * passIndicator) / sum(weight) over scored
   * non-NA items. 0..1 fraction. NaN if no scored items remain after NA;
   * normalised to 0 in the result.
   */
  readonly weightedScore: number;
  /** items with a non-empty comment / total. 0..1. */
  readonly commentDensity: number;
  /** Number of blockingOnFail items that received `fail`. */
  readonly blockingFailures: number;
}

/**
 * Productivity feed payload. Stable shape consumed by `@auditforge/billing`'s
 * `AuditorProductivityMetrics`. Versioned so future breaking changes can
 * be coordinated.
 */
export interface AuditorProductivityFeed {
  readonly version: 1;
  readonly firmId: string;
  readonly auditorId: string;
  readonly engagementId: string;
  readonly peerReviewId: string;
  readonly auditKind: PeerReviewRequest['auditKind'];
  readonly aggregate: QualityAggregate;
  /** ISO-8601 instant the score was computed. */
  readonly computedAt: string;
}

export class QualityScoring {
  /**
   * Pure aggregation over `request.responses` × `checklist.items`. Throws
   * `ValidationError` on schema mismatch (response refers to unknown item;
   * NA used on `naAllowed=false` item).
   */
  static aggregate(
    request: PeerReviewRequest,
    checklist: PeerReviewChecklist,
  ): QualityAggregate {
    const itemMap = new Map<string, QualityChecklistItem>();
    for (const item of checklist.items) itemMap.set(item.id, item);

    let answered = 0;
    let passed = 0;
    let failed = 0;
    let skippedNa = 0;
    let weightedNum = 0;
    let weightedDen = 0;
    let commentCount = 0;
    let blockingFailures = 0;

    const seen = new Set<string>();
    for (const r of request.responses) {
      const item = itemMap.get(r.itemId);
      if (!item) {
        throw new ValidationError(
          `Response references unknown checklist item: ${r.itemId}`,
          { itemId: r.itemId, checklistId: checklist.id },
        );
      }
      if (seen.has(r.itemId)) {
        throw new ValidationError(`Duplicate response for item: ${r.itemId}`, {
          itemId: r.itemId,
        });
      }
      seen.add(r.itemId);

      if (r.response === 'na' && !item.naAllowed) {
        throw new ValidationError(
          `NA not allowed for item: ${r.itemId}`,
          { itemId: r.itemId },
        );
      }
      if (r.comment.trim().length > 0) commentCount += 1;

      if (r.response === 'na') {
        skippedNa += 1;
        continue;
      }
      answered += 1;
      if (r.response === 'pass') passed += 1;
      if (r.response === 'fail') {
        failed += 1;
        if (item.blockingOnFail) blockingFailures += 1;
      }

      if (item.weight > 0) {
        weightedDen += item.weight;
        if (r.response === 'pass') weightedNum += item.weight;
      }
    }

    const total = checklist.items.length;
    const passRate = answered === 0 ? 0 : passed / answered;
    const failRate = answered === 0 ? 0 : failed / answered;
    const naRate = total === 0 ? 0 : skippedNa / total;
    const weightedScore = weightedDen === 0 ? 0 : weightedNum / weightedDen;
    const commentDensity = total === 0 ? 0 : commentCount / total;

    return {
      answered,
      passed,
      failed,
      skippedNa,
      total,
      passRate,
      failRate,
      naRate,
      weightedScore,
      commentDensity,
      blockingFailures,
    };
  }

  /**
   * Build a productivity feed payload to hand to @auditforge/billing.
   *
   * `auditorId` here is the *primary auditor whose work was reviewed* — i.e.
   * the auditor whose productivity score is being updated. `computedAt`
   * defaults to `new Date().toISOString()` if omitted; tests pass a fixed
   * clock for determinism.
   */
  static productivityFeed(args: {
    request: PeerReviewRequest;
    checklist: PeerReviewChecklist;
    computedAt?: string;
  }): AuditorProductivityFeed {
    const aggregate = QualityScoring.aggregate(args.request, args.checklist);
    return {
      version: 1,
      firmId: args.request.firmId,
      auditorId: args.request.primaryAuditorId,
      engagementId: args.request.engagementId,
      peerReviewId: args.request.id,
      auditKind: args.request.auditKind,
      aggregate,
      computedAt: args.computedAt ?? new Date().toISOString(),
    };
  }

  /**
   * Convenience flag: did the reviewer encounter any `blockingOnFail` items
   * with `fail`? Used by workflow.approve() to require an override comment.
   */
  static hasBlockingFailures(
    request: PeerReviewRequest,
    checklist: PeerReviewChecklist,
  ): boolean {
    return QualityScoring.aggregate(request, checklist).blockingFailures > 0;
  }
}
