// SPDX-License-Identifier: BUSL-1.1
import { ValidationError } from '@auditforge/shared';
import type {
  IndependencePolicy,
  ReviewerRecord,
} from '../domain/independence.js';

/**
 * Hard invariants for peer-reviewer independence. These are the
 * non-negotiable rules; CB policies layered on top of these may only stiffen
 * them, never weaken them.
 *
 * Hard rule 1: The peer reviewer cannot be the engagement's primary lead
 *              auditor. Detected by exact UUID match.
 * Hard rule 2: The peer reviewer cannot be on the engagement team. Detected
 *              by inclusion in `engagementTeamIds`.
 *
 * Soft rules (CB-overridable, see `IndependencePolicy`):
 *   - Reciprocal-review lookback (must not have reviewed the auditor's last
 *     N engagements).
 *   - Supervisor exclusion.
 *   - Required reviewer roles.
 *   - CB-defined excluded auditor ids.
 */

export interface IndependenceContext {
  readonly firmId: string;
  readonly primaryAuditorId: string;
  readonly engagementTeamIds: readonly string[];
  readonly candidate: ReviewerRecord;
  readonly policy: IndependencePolicy;
}

export type IndependenceViolation =
  | 'reviewer_is_primary'
  | 'reviewer_on_team'
  | 'wrong_firm'
  | 'missing_role_peer_reviewer'
  | 'missing_required_role'
  | 'reciprocal_review_window'
  | 'supervisor_relationship'
  | 'cb_excluded';

export interface IndependenceCheckResult {
  readonly ok: boolean;
  readonly violations: readonly IndependenceViolation[];
}

export class InvariantsChecker {
  /**
   * Pure function — no IO. Returns every violation found rather than
   * short-circuiting, so `apps/api` can surface a complete error list to
   * the user.
   */
  static check(ctx: IndependenceContext): IndependenceCheckResult {
    const violations: IndependenceViolation[] = [];

    if (ctx.candidate.firmId !== ctx.firmId) {
      violations.push('wrong_firm');
    }

    // Hard rule 1
    if (ctx.candidate.auditorId === ctx.primaryAuditorId) {
      violations.push('reviewer_is_primary');
    }

    // Hard rule 2
    if (ctx.engagementTeamIds.includes(ctx.candidate.auditorId)) {
      violations.push('reviewer_on_team');
    }

    // Hard rule 3 (role): everybody must hold `peer_reviewer` to act as one.
    if (!ctx.candidate.roles.includes('peer_reviewer')) {
      violations.push('missing_role_peer_reviewer');
    }

    // Soft rule: required roles intersection.
    if (ctx.policy.requiredRoles.length > 0) {
      const has = (r: string): boolean => ctx.candidate.roles.includes(r);
      const missing = ctx.policy.requiredRoles.some((r) => !has(r));
      if (missing) violations.push('missing_required_role');
    }

    // Soft rule: reciprocal-review lookback.
    if (ctx.policy.reciprocalLookback > 0) {
      const recent = ctx.candidate.recentReviewsForAuditor.slice(
        0,
        ctx.policy.reciprocalLookback,
      );
      if (recent.length > 0) violations.push('reciprocal_review_window');
    }

    // Soft rule: supervisor exclusion.
    if (
      ctx.policy.excludeSupervisor &&
      (ctx.candidate.supervisorOf ?? []).includes(ctx.primaryAuditorId)
    ) {
      violations.push('supervisor_relationship');
    }

    // CB-defined exclusions.
    if (ctx.policy.excludedAuditorIds.includes(ctx.candidate.auditorId)) {
      violations.push('cb_excluded');
    }

    return { ok: violations.length === 0, violations: Object.freeze(violations) };
  }

  /**
   * Same as `check` but throws `ValidationError` with the violation list
   * attached to `details.violations`.
   */
  static require(ctx: IndependenceContext): void {
    const result = InvariantsChecker.check(ctx);
    if (result.ok) return;
    throw new ValidationError('Peer-reviewer independence violation', {
      violations: result.violations,
      reviewerId: ctx.candidate.auditorId,
      primaryAuditorId: ctx.primaryAuditorId,
    });
  }
}
