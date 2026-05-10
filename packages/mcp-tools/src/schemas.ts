// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

export const EngagementIdSchema = z.string().min(1);
export const ClauseIdSchema = z.string().min(1);

export const LibrarySearchInput = z
  .object({
    query: z.string().min(1).max(500),
    clauseFilter: z.array(ClauseIdSchema).optional(),
    limit: z.number().int().min(1).max(50).default(10).optional(),
  })
  .strict();
export type LibrarySearchInputT = z.infer<typeof LibrarySearchInput>;

export const LibrarySearchOutput = z.array(
  z.object({
    id: z.string(),
    text: z.string(),
    clauseIds: z.array(ClauseIdSchema),
    score: z.number(),
  }),
);
export type LibrarySearchOutputT = z.infer<typeof LibrarySearchOutput>;

export const WorkingPaperReadInput = z
  .object({
    engagementId: EngagementIdSchema,
    workingPaperId: z.string().min(1),
  })
  .strict();
export type WorkingPaperReadInputT = z.infer<typeof WorkingPaperReadInput>;

export const WorkingPaperReadOutput = z
  .object({
    id: z.string(),
    engagementId: z.string(),
    clauseId: z.string(),
    title: z.string(),
    status: z.enum(['draft', 'final']),
    content: z.string(),
    updatedAt: z.string(),
  })
  .nullable();
export type WorkingPaperReadOutputT = z.infer<typeof WorkingPaperReadOutput>;

export const ReportListInput = z
  .object({ engagementId: EngagementIdSchema })
  .strict();
export type ReportListInputT = z.infer<typeof ReportListInput>;

export const ReportListOutput = z.array(
  z.object({
    id: z.string(),
    engagementId: z.string(),
    kind: z.enum(['draft', 'final', 'readiness']),
    status: z.enum(['draft', 'pending-signature', 'published']),
    createdAt: z.string(),
    publishedAt: z.string().nullable(),
  }),
);
export type ReportListOutputT = z.infer<typeof ReportListOutput>;

export const ReportPublishInput = z
  .object({
    engagementId: EngagementIdSchema,
    reportId: z.string().min(1),
    confirmationToken: z.string().min(8),
  })
  .strict();
export type ReportPublishInputT = z.infer<typeof ReportPublishInput>;

export const ReportPublishOutput = z.object({
  id: z.string(),
  engagementId: z.string(),
  status: z.enum(['published']),
  publishedAt: z.string(),
  signature: z.object({
    keyId: z.string(),
    algorithm: z.string(),
    signatureBase64: z.string(),
  }),
});
export type ReportPublishOutputT = z.infer<typeof ReportPublishOutput>;

export const AiSystemInventoryProfileInput = z.object({}).strict();
export type AiSystemInventoryProfileInputT = z.infer<typeof AiSystemInventoryProfileInput>;

export const AiSystemInventoryProfileOutput = z.object({
  modelName: z.literal('auditforge-mcp'),
  version: z.string(),
  purpose: z.string(),
  capabilities: z.array(z.string()),
  limitations: z.array(z.string()),
  dataAccess: z.object({
    scope: z.enum(['per-engagement']),
    pii: z.boolean(),
    cloudEgress: z.boolean(),
  }),
  governance: z.object({
    standard: z.literal('ISO/IEC 42001'),
    auditTrail: z.literal('ed25519-signed-receipts'),
    confirmationRequired: z.array(z.string()),
  }),
});
export type AiSystemInventoryProfileOutputT = z.infer<typeof AiSystemInventoryProfileOutput>;
