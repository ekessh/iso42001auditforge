// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import {
  NonEmptyStringSchema,
  UuidSchema,
} from '@auditforge/shared';

/**
 * CB-configurable independence policy. Every field has a sane default; CBs
 * may stiffen rules but cannot weaken the two non-negotiable invariants
 * (reviewer != primary, reviewer not on team).
 */
export const IndependencePolicySchema = z.object({
  firmId: UuidSchema,
  /**
   * How many of the auditor's recent engagements (chronologically) the
   * reviewer must not have peer-reviewed. Default 2; may be increased.
   * 0 disables the lookback rule (NOT recommended; CB risk).
   */
  reciprocalLookback: z.number().int().min(0).max(50).default(2),
  /**
   * If true, the reviewer must not be the auditor's manager-of-record at the
   * firm (supervisor independence). Default true.
   */
  excludeSupervisor: z.boolean().default(true),
  /**
   * Optional list of role names the reviewer must hold (intersected with the
   * generic `peer_reviewer` requirement). E.g. CB requires `senior_auditor`
   * for stage-2 reviews.
   */
  requiredRoles: z.array(NonEmptyStringSchema).default([]),
  /**
   * Optional list of additional auditor ids that must be excluded from being
   * reviewers for this firm — typically firm-internal exec/board members.
   */
  excludedAuditorIds: z.array(UuidSchema).default([]),
  /**
   * Free-text notes the CB attaches to the policy (audit ledger captures
   * these for accreditation).
   */
  notes: z.string().max(4000).default(''),
});
export type IndependencePolicy = z.infer<typeof IndependencePolicySchema>;

export type IndependencePolicyInput = z.input<typeof IndependencePolicySchema>;

export const DEFAULT_POLICY = Object.freeze<Omit<IndependencePolicy, 'firmId'>>({
  reciprocalLookback: 2,
  excludeSupervisor: true,
  requiredRoles: [],
  excludedAuditorIds: [],
  notes: '',
});

/**
 * Auditor-record snapshot used by `InvariantsChecker.canReview`. Supplied by
 * the caller (apps/api) so this domain library never reaches into auth or
 * directory state.
 */
export interface ReviewerRecord {
  readonly auditorId: string;
  readonly firmId: string;
  /** Roles held at the firm. Must include `peer_reviewer`. */
  readonly roles: readonly string[];
  /** Direct manager (supervisor) — optional. */
  readonly supervisorOf?: readonly string[];
  /** Engagements (chronological, newest first) the candidate previously
   * peer-reviewed for the auditor under review. */
  readonly recentReviewsForAuditor: readonly string[];
}
