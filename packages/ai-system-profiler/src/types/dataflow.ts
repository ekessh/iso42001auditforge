// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import { UuidSchema } from '../compat/shared.js';

/**
 * Data classification labels — coarse but sufficient for ISO 42001
 * Annex A.7 (Data for AI systems) review and EU AI Act Article 10
 * (data and data governance) coverage.
 */
export const DataClassificationSchema = z.enum([
  'public',
  'internal',
  'confidential',
  'restricted',
  'pii',
  'phi',
  'biometric',
  'children',
  'special_category_gdpr',
]);
export type DataClassification = z.infer<typeof DataClassificationSchema>;

export const DataFlowNodeKindSchema = z.enum(['source', 'processing', 'sink']);
export type DataFlowNodeKind = z.infer<typeof DataFlowNodeKindSchema>;

export const DataFlowNodeSchema = z.object({
  id: z.string().min(1).max(120),
  kind: DataFlowNodeKindSchema,
  label: z.string().min(1).max(240),
  classifications: z.array(DataClassificationSchema).default([]),
  /** Retention in days — 0 = no retention. */
  retentionDays: z.number().int().nonnegative().optional(),
  /** Disposal method per A.7.5 (data quality / lifecycle). */
  disposal: z
    .enum(['cryptographic_erase', 'overwrite', 'physical_destruction', 'expire_in_place', 'unknown'])
    .optional(),
  /** Where the node physically resides — informs cross-border transfer review. */
  jurisdiction: z.string().max(120).optional(),
});
export type DataFlowNode = z.infer<typeof DataFlowNodeSchema>;

export const DataFlowEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  /** Encrypted in transit? */
  encrypted: z.boolean().optional(),
  /** Description of the transformation (PII redaction, embedding, etc.). */
  transformation: z.string().max(1000).optional(),
});
export type DataFlowEdge = z.infer<typeof DataFlowEdgeSchema>;

export const AiSystemDataFlowSchema = z
  .object({
    aiSystemId: UuidSchema,
    nodes: z.array(DataFlowNodeSchema).min(1),
    edges: z.array(DataFlowEdgeSchema),
  })
  .superRefine((flow, ctx) => {
    const ids = new Set(flow.nodes.map((n) => n.id));
    if (ids.size !== flow.nodes.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'duplicate node id', path: ['nodes'] });
    }
    flow.edges.forEach((e, i) => {
      if (!ids.has(e.from)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['edges', i, 'from'],
          message: `unknown node "${e.from}"`,
        });
      }
      if (!ids.has(e.to)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['edges', i, 'to'],
          message: `unknown node "${e.to}"`,
        });
      }
    });
  });
export type AiSystemDataFlow = z.infer<typeof AiSystemDataFlowSchema>;
