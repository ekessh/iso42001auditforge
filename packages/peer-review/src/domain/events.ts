// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import {
  IsoDateSchema,
  NonEmptyStringSchema,
  UuidSchema,
} from '@auditforge/shared';
import {
  ItemResponseSchema,
  PeerReviewStatusSchema,
  PeerReviewVerdictSchema,
} from './enums.js';

/**
 * Outbound ledger events. The `apps/api` layer consumes these via the
 * `LedgerEmitter` port and signs them into the audit ledger (hash chain +
 * TSA) before persistence.
 */
export const PeerReviewLedgerEventSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('peer_review.created'),
    requestId: UuidSchema,
    firmId: UuidSchema,
    engagementId: UuidSchema,
    actorId: UuidSchema,
    at: IsoDateSchema,
  }),
  z.object({
    kind: z.literal('peer_review.assigned'),
    requestId: UuidSchema,
    reviewerId: UuidSchema,
    actorId: UuidSchema,
    at: IsoDateSchema,
  }),
  z.object({
    kind: z.literal('peer_review.response_recorded'),
    requestId: UuidSchema,
    itemId: NonEmptyStringSchema,
    response: ItemResponseSchema,
    actorId: UuidSchema,
    at: IsoDateSchema,
  }),
  z.object({
    kind: z.literal('peer_review.changes_requested'),
    requestId: UuidSchema,
    revisionCount: z.number().int().nonnegative(),
    actorId: UuidSchema,
    at: IsoDateSchema,
  }),
  z.object({
    kind: z.literal('peer_review.resubmitted'),
    requestId: UuidSchema,
    actorId: UuidSchema,
    at: IsoDateSchema,
  }),
  z.object({
    kind: z.literal('peer_review.signed_off'),
    requestId: UuidSchema,
    verdict: PeerReviewVerdictSchema,
    actorId: UuidSchema,
    at: IsoDateSchema,
  }),
  z.object({
    kind: z.literal('peer_review.withdrawn'),
    requestId: UuidSchema,
    actorId: UuidSchema,
    at: IsoDateSchema,
  }),
  z.object({
    kind: z.literal('peer_review.status_transition'),
    requestId: UuidSchema,
    from: PeerReviewStatusSchema,
    to: PeerReviewStatusSchema,
    actorId: UuidSchema,
    at: IsoDateSchema,
  }),
  z.object({
    kind: z.literal('peer_review.comment_added'),
    requestId: UuidSchema,
    commentId: UuidSchema,
    flag: z.enum(['standard', 'security', 'data-protection']),
    actorId: UuidSchema,
    at: IsoDateSchema,
  }),
  z.object({
    kind: z.literal('peer_review.comment_resolved'),
    requestId: UuidSchema,
    commentId: UuidSchema,
    actorId: UuidSchema,
    at: IsoDateSchema,
  }),
]);
export type PeerReviewLedgerEvent = z.infer<typeof PeerReviewLedgerEventSchema>;
