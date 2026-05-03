// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

/**
 * Audit kind — must mirror @auditforge/engagement audit kinds. Repeated here
 * to avoid a circular dependency; values must stay in sync.
 */
export const AuditKindSchema = z.enum([
  'stage1',
  'stage2',
  'surveillance',
  'recertification',
  'special',
]);
export type AuditKind = z.infer<typeof AuditKindSchema>;

/**
 * Per-item response. `na` means the item is not applicable to the engagement
 * (e.g., AI-system-specific item on a non-AI sub-scope). NA items are excluded
 * from numerator and denominator in pass-rate computation.
 */
export const ItemResponseSchema = z.enum(['pass', 'fail', 'na']);
export type ItemResponse = z.infer<typeof ItemResponseSchema>;

/**
 * Final reviewer verdict. `approve` clears the engagement for issuance;
 * `request-changes` requires the auditor to address comments and resubmit.
 */
export const PeerReviewVerdictSchema = z.enum(['approve', 'request-changes']);
export type PeerReviewVerdict = z.infer<typeof PeerReviewVerdictSchema>;

/**
 * Workflow status — finite state machine; see `workflow/state-machine.ts`.
 */
export const PeerReviewStatusSchema = z.enum([
  'pending',
  'in_review',
  'changes_requested',
  'approved',
  'withdrawn',
]);
export type PeerReviewStatus = z.infer<typeof PeerReviewStatusSchema>;

export const ALL_PEER_REVIEW_STATUSES: readonly PeerReviewStatus[] = [
  'pending',
  'in_review',
  'changes_requested',
  'approved',
  'withdrawn',
];

export const TERMINAL_STATUSES: ReadonlySet<PeerReviewStatus> = new Set<PeerReviewStatus>(
  ['approved', 'withdrawn'],
);

export const ALL_AUDIT_KINDS: readonly AuditKind[] = [
  'stage1',
  'stage2',
  'surveillance',
  'recertification',
  'special',
];
