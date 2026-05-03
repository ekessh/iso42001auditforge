// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import { UuidSchema, NonEmptyStringSchema, IsoDateSchema } from '@auditforge/shared';

export const RetrievalCandidateSchema = z.object({
  claimId: UuidSchema,
  lexicalRank: z.number().int().nonnegative().nullable(),
  vectorRank: z.number().int().nonnegative().nullable(),
  graphHops: z.number().int().nonnegative().nullable(),
  fusedScore: z.number(),
  source: z.array(z.enum(['bm25', 'vector', 'graph'])),
});
export type RetrievalCandidate = z.infer<typeof RetrievalCandidateSchema>;

export const RetrievalInvocationSchema = z.object({
  id: UuidSchema,
  firmId: UuidSchema,
  engagementId: UuidSchema,
  query: NonEmptyStringSchema,
  candidates: z.array(RetrievalCandidateSchema),
  rankedResults: z.array(RetrievalCandidateSchema),
  modelInvocationId: UuidSchema.nullable(),
  atTime: IsoDateSchema,
});
export type RetrievalInvocation = z.infer<typeof RetrievalInvocationSchema>;

export const ExtractionRejectionSchema = z.object({
  reason: NonEmptyStringSchema,
  raw: z.unknown(),
});
export type ExtractionRejection = z.infer<typeof ExtractionRejectionSchema>;

export const ExtractionInvocationSchema = z.object({
  id: UuidSchema,
  firmId: UuidSchema,
  engagementId: UuidSchema,
  sourceEpisodeId: UuidSchema,
  modelInvocationId: UuidSchema,
  schemaVersionId: UuidSchema,
  rawOutput: z.string(),
  parsedClaimIds: z.array(UuidSchema).default([]),
  rejectedReasons: z.array(ExtractionRejectionSchema).default([]),
  createdAt: IsoDateSchema,
});
export type ExtractionInvocation = z.infer<typeof ExtractionInvocationSchema>;
