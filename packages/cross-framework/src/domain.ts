// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

export const Framework = z.enum([
  'ISO42001', 'ISO42001_AnnexA', 'EU_AI_Act', 'NIST_AI_RMF',
  'ISO_23894', 'ISO_5338', 'OWASP_LLM10', 'NIST_CSF', 'ISO_27001',
]);
export type Framework = z.infer<typeof Framework>;

export const RelationshipStrength = z.enum(['equivalent', 'subsumes', 'supports', 'partial', 'referenced_by']);
export type RelationshipStrength = z.infer<typeof RelationshipStrength>;

export const FrameworkNode = z.object({
  framework: Framework,
  nodeId: z.string(),
  title: z.string(),
});
export type FrameworkNode = z.infer<typeof FrameworkNode>;

export const FrameworkMapping = z.object({
  id: z.string().uuid(),
  source: FrameworkNode,
  target: FrameworkNode,
  relationship: RelationshipStrength,
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(5),
  citation: z.string().optional(),
  smeSignedOffBy: z.string().uuid().nullable(),
  smeSignedOffAt: z.string().datetime().nullable(),
});
export type FrameworkMapping = z.infer<typeof FrameworkMapping>;
