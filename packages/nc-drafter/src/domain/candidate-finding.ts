// SPDX-License-Identifier: BUSL-1.1
/**
 * Candidate Finding domain model.
 *
 * Per ADR 0012 (engine outputs as drafts) and v3 §15.6, a candidate finding is
 * the engine-produced draft of a potential audit finding. It NEVER surfaces to
 * the auditee — only formal `Finding` records (post-promotion, post-peer-review
 * where applicable) cross that boundary.
 */
import { z } from 'zod';
import {
  IsoDateSchema,
  NonEmptyStringSchema,
  UuidSchema,
} from '@auditforge/shared';

/** Candidate finding type — distinct from `FindingType` so that `observation`
 * is preserved at the candidate stage even though the v2 finding model
 * expresses observations as `ofi`. The promotion step downcasts as needed. */
export const CandidateFindingTypeSchema = z.enum([
  'major_nc',
  'minor_nc',
  'ofi',
  'observation',
]);
export type CandidateFindingType = z.infer<typeof CandidateFindingTypeSchema>;

/** Lifecycle status. Set on the row; transitions are append-only via the
 * decisions table. */
export const CandidateFindingStatusSchema = z.enum([
  'pending',
  'promoted',
  'dismissed',
  'parked',
  'edited',
]);
export type CandidateFindingStatus = z.infer<
  typeof CandidateFindingStatusSchema
>;

/** Reasons captured on dismissal — feed Phase 16 negative training corpus. */
export const DismissalReasonCodeSchema = z.enum([
  'false_positive',
  'not_in_scope',
  'duplicate',
  'other',
]);
export type DismissalReasonCode = z.infer<typeof DismissalReasonCodeSchema>;

/** Wrapped reason: when code is `other`, free-text is required. */
export const DismissalReasonSchema = z
  .object({
    code: DismissalReasonCodeSchema,
    note: z.string().max(2_000).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.code === 'other') {
      if (!val.note || val.note.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'DismissalReason: free-text "note" is required when code === "other"',
          path: ['note'],
        });
      }
    }
  });
export type DismissalReason = z.infer<typeof DismissalReasonSchema>;

/** Confidence score from the drafter — bands per v3 §15.4. */
export const ConfidenceSchema = z.number().min(0).max(1);

/** Audit type used to choose severity for direct conformity gaps. */
export const AuditTypeSchema = z.enum([
  'stage_1',
  'stage_2',
  'surveillance',
  'recertification',
  'special',
  'readiness',
]);
export type AuditType = z.infer<typeof AuditTypeSchema>;

/**
 * Severity rationale: human-readable string explaining why the drafter chose
 * Major vs Minor (or OFI). Kept as free-text but bounded.
 */
export const SeverityRationaleSchema = z.string().min(1).max(2_000);

export const RootCausePromptSchema = z.string().min(1).max(500);

export const ClauseIdSchema = z
  .string()
  .min(1)
  .max(64);

export const ControlIdSchema = z
  .string()
  .min(1)
  .max(64);

export const ClaimIdSchema = z.string().min(1).max(128);
export const EpisodeIdSchema = z.string().min(1).max(128);
export const ModelInvocationIdSchema = z.string().min(1).max(128);

export const CandidateFindingBaseShape = {
  id: UuidSchema,
  firmId: UuidSchema,
  engagementId: UuidSchema,
  type: CandidateFindingTypeSchema,
  draftStatement: NonEmptyStringSchema,
  linkedClauses: z.array(ClauseIdSchema).default([]),
  linkedControls: z.array(ControlIdSchema).default([]),
  /**
   * Source claim IDs. May be empty for the EvidenceAbsenceDetector, where the
   * finding pivots on the absence of a claim rather than its presence; the
   * superRefine on `CandidateFindingSchema` requires at least one of
   * {sourceClaimIds, linkedClauses} to be non-empty so a row is never
   * decoupled from the clause/claim chain.
   */
  sourceClaimIds: z.array(ClaimIdSchema).default([]),
  sourceEpisodeIds: z.array(EpisodeIdSchema).default([]),
  confidence: ConfidenceSchema,
  suggestedRootCausePrompts: z.array(RootCausePromptSchema).default([]),
  proposedSeverityRationale: SeverityRationaleSchema,
  modelInvocationId: ModelInvocationIdSchema.nullable(),
  status: CandidateFindingStatusSchema.default('pending'),
  createdAt: IsoDateSchema,
  decidedBy: UuidSchema.nullable(),
  decidedAt: IsoDateSchema.nullable(),
  dismissalReason: DismissalReasonSchema.nullable(),
  detectorId: NonEmptyStringSchema,
  promptTemplateVersion: z.string().min(1).max(64),
} as const;

const CandidateFindingObject = z.object(CandidateFindingBaseShape);

function requireClaimsOrClauses(
  val: { sourceClaimIds: readonly string[]; linkedClauses: readonly string[] },
  ctx: z.RefinementCtx,
): void {
  if (val.sourceClaimIds.length === 0 && val.linkedClauses.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'CandidateFinding: must have at least one of sourceClaimIds or linkedClauses',
      path: ['sourceClaimIds'],
    });
  }
}

export const CandidateFindingSchema =
  CandidateFindingObject.superRefine(requireClaimsOrClauses);
export type CandidateFinding = z.infer<typeof CandidateFindingSchema>;

/** Input for the drafter when materialising a row. The drafter assigns
 * `id`, `createdAt`, and the lifecycle defaults. */
export const NewCandidateFindingSchema = CandidateFindingObject.omit({
  id: true,
  createdAt: true,
  status: true,
  decidedBy: true,
  decidedAt: true,
  dismissalReason: true,
})
  .extend({ id: UuidSchema.optional() })
  .superRefine(requireClaimsOrClauses);
export type NewCandidateFinding = z.infer<typeof NewCandidateFindingSchema>;

/**
 * Mapping of a candidate finding into a v2 Finding creation payload. Actual
 * write goes through `@auditforge/findings`; this package only describes the
 * mapping shape.
 */
export const PromotionRequestSchema = z.object({
  candidateFindingId: UuidSchema,
  promotedBy: UuidSchema,
  promotedAt: IsoDateSchema,
  /** Optional auditor overrides applied at promotion time. */
  overrides: z
    .object({
      type: CandidateFindingTypeSchema.optional(),
      draftStatement: NonEmptyStringSchema.optional(),
      linkedClauses: z.array(ClauseIdSchema).optional(),
      linkedControls: z.array(ControlIdSchema).optional(),
      severityRationale: SeverityRationaleSchema.optional(),
      rootCausePromptResponse: NonEmptyStringSchema.optional(),
    })
    .default({}),
  /** Engagement-scoped audit event ID needed for v2 Finding creation. */
  auditEventId: UuidSchema,
  /** Engagement-scoped client ID needed for v2 Finding creation. */
  clientId: UuidSchema,
});
export type PromotionRequest = z.infer<typeof PromotionRequestSchema>;

/** Per-row decision audit entry. Append-only. */
export const CandidateFindingDecisionActionSchema = z.enum([
  'promote',
  'dismiss',
  'park',
  'edit',
  'unpark',
]);
export type CandidateFindingDecisionAction = z.infer<
  typeof CandidateFindingDecisionActionSchema
>;

export const CandidateFindingDecisionSchema = z.object({
  id: UuidSchema,
  candidateFindingId: UuidSchema,
  action: CandidateFindingDecisionActionSchema,
  actor: UuidSchema,
  at: IsoDateSchema,
  dismissalReason: DismissalReasonSchema.nullable(),
  promotedFindingId: UuidSchema.nullable(),
  notes: z.string().max(4_000).nullable(),
});
export type CandidateFindingDecision = z.infer<
  typeof CandidateFindingDecisionSchema
>;
