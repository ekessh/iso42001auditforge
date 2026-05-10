// SPDX-License-Identifier: BUSL-1.1
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

const UuidStringSchema = z.string().uuid();
const NonEmptySchema = z.string().min(1).max(10000);
const IsoDateString = z.string().min(1);

export const EvaluateChecklistSchema = z.object({
  engagementId: UuidStringSchema,
  mode: z.enum(['audit', 'readiness']),
  draft: z.object({
    reportId: UuidStringSchema,
    type: NonEmptySchema,
    status: z.enum(['draft', 'in_review', 'signed_final', 'archived']),
    scopeStatement: z.string().default(''),
    methodologyStatement: z.string().default(''),
    hasMandatoryDisclaimer: z.boolean().default(false),
    contentHash: z.string().regex(/^[0-9a-f]{64}$/).optional(),
  }),
  findings: z
    .array(
      z.object({
        findingId: UuidStringSchema,
        evidenceRefs: z.array(UuidStringSchema).default([]),
      }),
    )
    .default([]),
  candidateFindings: z
    .array(
      z.object({
        candidateId: UuidStringSchema,
        status: z.enum(['open', 'promoted', 'dismissed']),
      }),
    )
    .default([]),
  peerReview: z.object({
    required: z.boolean(),
    status: z
      .enum(['pending', 'in_review', 'changes_requested', 'approved', 'withdrawn'])
      .optional(),
    approvedAt: IsoDateString.optional(),
    reviewerId: UuidStringSchema.optional(),
    securityReviewRequired: z.boolean().default(false),
    securityReviewerId: UuidStringSchema.optional(),
    securityApprovedAt: IsoDateString.optional(),
  }),
  samplingPlan: z
    .object({
      planId: UuidStringSchema,
      documentedAt: IsoDateString,
    })
    .optional(),
  impartiality: z.object({
    declared: z.boolean(),
    declaredAt: IsoDateString.optional(),
    declaredBy: UuidStringSchema.optional(),
  }),
  signing: z.object({
    signingKeyId: NonEmptySchema.optional(),
    tsaAnchorId: NonEmptySchema.optional(),
  }),
  overrides: z
    .record(
      NonEmptySchema,
      z.object({
        actorId: UuidStringSchema,
        rationale: NonEmptySchema,
        at: IsoDateString,
      }),
    )
    .default({}),
});
export type EvaluateChecklistDto = z.infer<typeof EvaluateChecklistSchema>;

export class ChecklistItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['pass', 'fail', 'overridden', 'skipped'] }) status!:
    | 'pass'
    | 'fail'
    | 'overridden'
    | 'skipped';
  @ApiProperty() reason!: string;
  @ApiProperty({ required: false }) overrideRationale?: string;
}

export class ChecklistResultDto {
  @ApiProperty() passed!: boolean;
  @ApiProperty({ type: [ChecklistItemDto] }) items!: ChecklistItemDto[];
}

export const OverrideChecklistItemSchema = z.object({
  engagementId: UuidStringSchema,
  reportId: UuidStringSchema,
  itemId: NonEmptySchema,
  rationale: NonEmptySchema.refine((s) => s.trim().length >= 8, {
    message: 'Rationale must be at least 8 chars',
  }),
});
export type OverrideChecklistItemDto = z.infer<typeof OverrideChecklistItemSchema>;
