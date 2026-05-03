// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import { UuidSchema, NonEmptyStringSchema, IsoDateSchema } from '@auditforge/shared';

export const ClaimValiditySchema = z.enum(['active', 'invalidated', 'superseded']);
export type ClaimValidity = z.infer<typeof ClaimValiditySchema>;

export const ExtractedBySchema = z.object({
  modelName: NonEmptyStringSchema,
  modelInvocationId: UuidSchema,
});
export type ExtractedBy = z.infer<typeof ExtractedBySchema>;

export const ClaimSchema = z.object({
  id: UuidSchema,
  firmId: UuidSchema,
  engagementId: UuidSchema,
  schemaVersionId: UuidSchema,
  entityType: NonEmptyStringSchema,
  subject: NonEmptyStringSchema,
  predicate: NonEmptyStringSchema,
  object: NonEmptyStringSchema,
  evidenceEpisodeIds: z.array(UuidSchema).default([]),
  extractedBy: ExtractedBySchema,
  eventTimeStart: IsoDateSchema,
  eventTimeEnd: IsoDateSchema.nullable(),
  ingestionTime: IsoDateSchema,
  validity: ClaimValiditySchema,
  embedding: z.array(z.number()).nullable().optional(),
});
export type Claim = z.infer<typeof ClaimSchema>;

export const NewClaimSchema = ClaimSchema.omit({
  id: true,
  ingestionTime: true,
  validity: true,
}).extend({
  id: UuidSchema.optional(),
  validity: ClaimValiditySchema.optional(),
});
export type NewClaim = z.infer<typeof NewClaimSchema>;

export const ClaimRelationKindSchema = z.enum(['contradicts', 'supersedes', 'supports']);
export type ClaimRelationKind = z.infer<typeof ClaimRelationKindSchema>;

export const ClaimRelationSchema = z.object({
  id: UuidSchema,
  firmId: UuidSchema,
  engagementId: UuidSchema,
  claimAId: UuidSchema,
  relation: ClaimRelationKindSchema,
  claimBId: UuidSchema,
  rationale: z.string().max(4000).default(''),
  createdAt: IsoDateSchema,
});
export type ClaimRelation = z.infer<typeof ClaimRelationSchema>;

export const ClaimAttributionStatusSchema = z.enum([
  'pending',
  'confirmed',
  'rejected',
  'reassigned',
]);
export type ClaimAttributionStatus = z.infer<typeof ClaimAttributionStatusSchema>;

export const ClaimAttributionSchema = z.object({
  id: UuidSchema,
  firmId: UuidSchema,
  engagementId: UuidSchema,
  claimId: UuidSchema,
  framework: NonEmptyStringSchema,
  nodeId: NonEmptyStringSchema,
  confidence: z.number().min(0).max(1),
  rationale: z.string().max(4000).default(''),
  modelInvocationId: UuidSchema,
  status: ClaimAttributionStatusSchema,
  createdAt: IsoDateSchema,
  decidedAt: IsoDateSchema.nullable(),
  decidedBy: UuidSchema.nullable(),
});
export type ClaimAttribution = z.infer<typeof ClaimAttributionSchema>;
