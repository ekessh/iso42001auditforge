// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import {
  IsoDateSchema,
  NonEmptyStringSchema,
  UuidSchema,
} from '@auditforge/shared';

/**
 * Reviewer comments are scoped to a specific finding or clause within the
 * review package. Threads are append-only — replies are stored as further
 * comments referencing the parent. Resolution is required before the package
 * may transition to `approved`.
 */

export const PeerReviewCommentScopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('finding'), findingId: UuidSchema }),
  z.object({ kind: z.literal('clause'), clauseRef: NonEmptyStringSchema }),
  z.object({ kind: z.literal('global') }),
]);
export type PeerReviewCommentScope = z.infer<typeof PeerReviewCommentScopeSchema>;

export const PeerReviewCommentSchema = z.object({
  id: UuidSchema,
  packageId: UuidSchema,
  parentId: UuidSchema.nullable(),
  authorId: UuidSchema,
  scope: PeerReviewCommentScopeSchema,
  body: NonEmptyStringSchema,
  createdAt: IsoDateSchema,
  resolvedAt: IsoDateSchema.optional(),
  resolvedBy: UuidSchema.optional(),
  /** Optional resolution note from the auditor. */
  resolutionNote: z.string().optional(),
  /** Severity flag the reviewer can apply — security/data-protection trigger
   *  the +1 security-reviewer rule via the API. */
  flag: z.enum(['standard', 'security', 'data-protection']).default('standard'),
});
export type PeerReviewComment = z.infer<typeof PeerReviewCommentSchema>;

/**
 * Walk all comments and group into thread roots. Stable ordering by
 * createdAt then id for deterministic UI rendering.
 */
export function threadsFrom(comments: readonly PeerReviewComment[]): {
  root: PeerReviewComment;
  replies: PeerReviewComment[];
}[] {
  const sorted = [...comments].sort((a, b) =>
    a.createdAt === b.createdAt
      ? a.id.localeCompare(b.id)
      : a.createdAt.localeCompare(b.createdAt),
  );
  const roots = sorted.filter((c) => c.parentId === null);
  return roots.map((root) => ({
    root,
    replies: sorted.filter((c) => c.parentId === root.id),
  }));
}

/**
 * Returns true when every root thread has a resolvedAt — required before
 * the package may move to `approved`.
 */
export function allThreadsResolved(comments: readonly PeerReviewComment[]): boolean {
  const threads = threadsFrom(comments);
  if (threads.length === 0) return true;
  return threads.every((t) => Boolean(t.root.resolvedAt));
}

/**
 * Returns true when any unresolved thread has a security or data-protection
 * flag — used by the API to enforce the +1 security reviewer rule.
 */
export function hasSecuritySensitiveOpenThread(
  comments: readonly PeerReviewComment[],
): boolean {
  const threads = threadsFrom(comments);
  return threads.some(
    (t) =>
      !t.root.resolvedAt &&
      (t.root.flag === 'security' || t.root.flag === 'data-protection'),
  );
}
