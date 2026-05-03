// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import {
  IsoDateSchema,
  NonEmptyStringSchema,
  SemverSchema,
  UuidSchema,
} from '@auditforge/shared';
import {
  AuditKindSchema,
  ItemResponseSchema,
  PeerReviewStatusSchema,
  PeerReviewVerdictSchema,
} from './enums.js';

/**
 * One reviewer answer for one checklist item. `comment` is required for
 * `fail` (validated in workflow) and recommended for `na`.
 */
export const PeerReviewResponseSchema = z.object({
  itemId: NonEmptyStringSchema,
  response: ItemResponseSchema,
  comment: z.string().max(8000).default(''),
  answeredAt: IsoDateSchema,
});
export type PeerReviewResponse = z.infer<typeof PeerReviewResponseSchema>;

/**
 * Sign-off block. Captured when the reviewer transitions to `approved` or
 * `changes_requested`. The `signature` field is opaque base64; the actual
 * cryptographic signing happens in `apps/api` using the auditor's
 * WebAuthn/PKCS#11 key (per ADR on cryptographic signing).
 */
export const PeerReviewSignOffSchema = z.object({
  verdict: PeerReviewVerdictSchema,
  reviewerId: UuidSchema,
  signedAt: IsoDateSchema,
  signature: z.string().min(1).max(8192),
  /** Optional summary the reviewer attaches to the sign-off. */
  summary: z.string().max(8000).default(''),
});
export type PeerReviewSignOff = z.infer<typeof PeerReviewSignOffSchema>;

/**
 * The peer-review request is a long-lived aggregate. It carries:
 *
 *   - the engagement under review (with primary auditor id captured at
 *     assignment time — used by `InvariantsChecker`)
 *   - the assigned reviewer (`reviewerId`) — must satisfy independence rules
 *   - the checklist binding (`checklistId` + `checklistVersion`) — frozen at
 *     assignment to avoid mid-flight schema drift
 *   - responses array (one per item)
 *   - status (FSM)
 *   - signOff (set when transitioning to terminal `approved` /
 *     `changes_requested` precursor states)
 */
export const PeerReviewRequestSchema = z.object({
  id: UuidSchema,
  firmId: UuidSchema,
  engagementId: UuidSchema,
  auditKind: AuditKindSchema,
  /** The engagement's primary lead auditor at assignment time. */
  primaryAuditorId: UuidSchema,
  /** All auditors on the engagement team at assignment time. */
  engagementTeamIds: z.array(UuidSchema).default([]),
  reviewerId: UuidSchema.optional(),
  checklistId: NonEmptyStringSchema,
  checklistVersion: SemverSchema,
  responses: z.array(PeerReviewResponseSchema).default([]),
  status: PeerReviewStatusSchema,
  signOff: PeerReviewSignOffSchema.optional(),
  /** Stamps */
  createdAt: IsoDateSchema,
  /** Bumped on every workflow transition. */
  updatedAt: IsoDateSchema,
  /** Set when `assign` succeeds. */
  assignedAt: IsoDateSchema.optional(),
  /** Set when `approved` or `withdrawn` (terminal). */
  closedAt: IsoDateSchema.optional(),
  /** Number of round-trips through `request_changes -> resubmit`. */
  revisionCount: z.number().int().nonnegative().default(0),
});
export type PeerReviewRequest = z.infer<typeof PeerReviewRequestSchema>;

export type PeerReviewRequestInput = z.input<typeof PeerReviewRequestSchema>;
