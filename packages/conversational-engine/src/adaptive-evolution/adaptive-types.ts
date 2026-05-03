// SPDX-License-Identifier: BUSL-1.1
/**
 * Shared types for the Adaptive Question Evolution sub-engine. All shapes are
 * deliberately decoupled from the Phase 7.6 Question Generator types so the
 * adaptive layer remains testable in isolation. Where overlap exists (e.g.
 * QuestionLibraryId) we re-export the canonical brand from the existing
 * `types/ids.ts` rather than redefining.
 */
import { z } from 'zod';
import { IsoDateSchema, UuidSchema } from '@auditforge/shared';

export const AdaptivePrioritySchema = z.number().min(0).max(1);
export type AdaptivePriority = z.infer<typeof AdaptivePrioritySchema>;

export const QueueQuestionKindSchema = z.enum([
  'library',
  'follow_up',
  'contradiction_resolution',
]);
export type QueueQuestionKind = z.infer<typeof QueueQuestionKindSchema>;

export const ClaimAttributionSchema = z.object({
  clauseId: z.string().min(1).max(64),
  controlId: z.string().min(1).max(64).nullable(),
  confidence: z.number().min(0).max(1),
});
export type ClaimAttribution = z.infer<typeof ClaimAttributionSchema>;

export const AdaptiveClaimSchema = z.object({
  id: z.string().min(1).max(128),
  text: z.string().min(1).max(10_000),
  /** ISO timestamp when captured. */
  capturedAt: IsoDateSchema,
  attributions: z.array(ClaimAttributionSchema).default([]),
  /** Whether this claim contradicts an earlier claim. */
  contradicts: z
    .object({
      earlierClaimId: z.string().min(1).max(128),
      contradictedClause: z.string().min(1).max(64),
    })
    .nullable()
    .default(null),
  /** "Shape" tag used by the FollowupInjector to match library follow-ups. */
  shape: z.string().min(1).max(64).nullable().default(null),
});
export type AdaptiveClaim = z.infer<typeof AdaptiveClaimSchema>;

export const QueuedQuestionSchema = z.object({
  id: UuidSchema,
  /** Library question ID when kind is 'library' or 'follow_up'; null for
   *  drafted contradiction-resolution questions (drafted in-memory). */
  libraryQuestionId: z.string().nullable(),
  kind: QueueQuestionKindSchema,
  text: z.string().min(1).max(10_000),
  /** Targets — drives the coverage-delta reflow. */
  targetClauses: z.array(z.string()).default([]),
  /** Current priority in [0,1]. Higher = surface sooner. */
  priority: AdaptivePrioritySchema,
  /** Source claim ID for follow-up / contradiction-resolution. */
  sourceClaimId: z.string().nullable(),
  /** Free-form shape tag library follow-ups match against. */
  shape: z.string().nullable().default(null),
  /** Whether the auditor has pinned this question. Pinned questions never
   *  drop in priority. */
  pinned: z.boolean().default(false),
});
export type QueuedQuestion = z.infer<typeof QueuedQuestionSchema>;

export const FollowupTemplateSchema = z.object({
  id: z.string().min(1).max(128),
  /** Shape tag this template responds to. */
  shape: z.string().min(1).max(64),
  text: z.string().min(1).max(10_000),
  targetClauses: z.array(z.string()).default([]),
});
export type FollowupTemplate = z.infer<typeof FollowupTemplateSchema>;

export const AdaptiveQueueStateSchema = z.object({
  reorderedQuestions: z.array(QueuedQuestionSchema),
  injectedQuestions: z.array(QueuedQuestionSchema),
  dismissedFromQueueIds: z.array(UuidSchema),
});
export type AdaptiveQueueState = z.infer<typeof AdaptiveQueueStateSchema>;

export const AttributionConfirmedEventSchema = z.object({
  engagementId: UuidSchema,
  claim: AdaptiveClaimSchema,
  at: IsoDateSchema,
});
export type AttributionConfirmedEvent = z.infer<
  typeof AttributionConfirmedEventSchema
>;

/**
 * Mapping of clause coverage state for the engagement. Used by the
 * CoverageDelta reflow step.
 */
export const CoverageStatusSchema = z.enum([
  'evidenced',
  'partial',
  'untouched',
  'contradicted',
  'na',
]);
export type CoverageStatus = z.infer<typeof CoverageStatusSchema>;

export const CoverageMapSchema = z.record(z.string(), CoverageStatusSchema);
export type CoverageMap = z.infer<typeof CoverageMapSchema>;

/**
 * Engagement mode — Audit (default, for CBs) vs Readiness (AIMS owners).
 * Termination semantics differ per mode (v3 §15.12).
 */
export const EngagementModeSchema = z.enum(['audit', 'readiness']);
export type EngagementMode = z.infer<typeof EngagementModeSchema>;
