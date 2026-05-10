// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import {
  IsoDateSchema,
  NonEmptyStringSchema,
  Sha256HexSchema,
  UuidSchema,
} from '@auditforge/shared';

export const EngagementModeSchema = z.enum(['audit', 'readiness']);
export type EngagementMode = z.infer<typeof EngagementModeSchema>;

export const ReportDraftSummarySchema = z.object({
  reportId: UuidSchema,
  type: NonEmptyStringSchema,
  status: z.enum(['draft', 'in_review', 'signed_final', 'archived']),
  scopeStatement: z.string().default(''),
  methodologyStatement: z.string().default(''),
  hasMandatoryDisclaimer: z.boolean().default(false),
  contentHash: Sha256HexSchema.optional(),
});
export type ReportDraftSummary = z.infer<typeof ReportDraftSummarySchema>;

export const FindingEvidenceLinkSchema = z.object({
  findingId: UuidSchema,
  evidenceRefs: z.array(UuidSchema).default([]),
});
export type FindingEvidenceLink = z.infer<typeof FindingEvidenceLinkSchema>;

export const CandidateFindingStateSchema = z.object({
  candidateId: UuidSchema,
  status: z.enum(['open', 'promoted', 'dismissed']),
});
export type CandidateFindingState = z.infer<typeof CandidateFindingStateSchema>;

export const PeerReviewStateSchema = z.object({
  required: z.boolean(),
  status: z
    .enum(['pending', 'in_review', 'changes_requested', 'approved', 'withdrawn'])
    .optional(),
  approvedAt: IsoDateSchema.optional(),
  reviewerId: UuidSchema.optional(),
  /** Whether the engagement scope contains security or data-protection findings;
   *  if true a second (security) reviewer must also have approved. */
  securityReviewRequired: z.boolean().default(false),
  securityReviewerId: UuidSchema.optional(),
  securityApprovedAt: IsoDateSchema.optional(),
});
export type PeerReviewState = z.infer<typeof PeerReviewStateSchema>;

export const SamplingPlanRefSchema = z.object({
  planId: UuidSchema,
  documentedAt: IsoDateSchema,
});
export type SamplingPlanRef = z.infer<typeof SamplingPlanRefSchema>;

export const ImpartialityDeclarationSchema = z.object({
  declared: z.boolean(),
  declaredAt: IsoDateSchema.optional(),
  declaredBy: UuidSchema.optional(),
});
export type ImpartialityDeclaration = z.infer<typeof ImpartialityDeclarationSchema>;

export const SigningMaterialSchema = z.object({
  signingKeyId: NonEmptyStringSchema.optional(),
  tsaAnchorId: NonEmptyStringSchema.optional(),
});
export type SigningMaterial = z.infer<typeof SigningMaterialSchema>;

export const ReportPublicationContextSchema = z.object({
  firmId: UuidSchema,
  engagementId: UuidSchema,
  mode: EngagementModeSchema,
  draft: ReportDraftSummarySchema,
  findings: z.array(FindingEvidenceLinkSchema).default([]),
  candidateFindings: z.array(CandidateFindingStateSchema).default([]),
  peerReview: PeerReviewStateSchema,
  samplingPlan: SamplingPlanRefSchema.optional(),
  impartiality: ImpartialityDeclarationSchema,
  signing: SigningMaterialSchema,
  /** Auditor explicit overrides keyed by check id. */
  overrides: z
    .record(
      NonEmptyStringSchema,
      z.object({
        actorId: UuidSchema,
        rationale: NonEmptyStringSchema,
        at: IsoDateSchema,
      }),
    )
    .default({}),
});
export type ReportPublicationContext = z.infer<typeof ReportPublicationContextSchema>;
