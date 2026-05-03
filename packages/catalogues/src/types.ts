// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

export const FrameworkIdSchema = z.enum([
  'ISO_42001',
  'ANNEX_A',
  'EU_AI_ACT',
  'NIST_AI_RMF',
  'OWASP_LLM_TOP10',
  'MITRE_ATLAS',
  'AVID',
  'MIT_AI_RISK',
]);
export type FrameworkId = z.infer<typeof FrameworkIdSchema>;

export const ClauseRefSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
});
export type ClauseRef = z.infer<typeof ClauseRefSchema>;

export const AnnexAControlRefSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: z.string().min(1),
});
export type AnnexAControlRef = z.infer<typeof AnnexAControlRefSchema>;

export const EuAiActRiskTierSchema = z.enum([
  'prohibited',
  'high',
  'limited',
  'minimal',
  'general-purpose',
  'general',
]);
export type EuAiActRiskTier = z.infer<typeof EuAiActRiskTierSchema>;

export const EuAiActArticleRefSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  riskTier: EuAiActRiskTierSchema,
});
export type EuAiActArticleRef = z.infer<typeof EuAiActArticleRefSchema>;

export const NistAiRmfFunctionSchema = z.enum(['GOVERN', 'MAP', 'MEASURE', 'MANAGE']);
export type NistAiRmfFunction = z.infer<typeof NistAiRmfFunctionSchema>;

export const NistAiRmfSubcategoryRefSchema = z.object({
  id: z.string().min(1),
  function: NistAiRmfFunctionSchema,
  title: z.string().min(1),
});
export type NistAiRmfSubcategoryRef = z.infer<typeof NistAiRmfSubcategoryRefSchema>;

export const OwaspLlmRiskRefSchema = z.object({
  id: z.string().regex(/^LLM\d{2}$/),
  title: z.string().min(1),
});
export type OwaspLlmRiskRef = z.infer<typeof OwaspLlmRiskRefSchema>;

export const MitreAtlasTechniqueRefSchema = z.object({
  id: z.string().regex(/^AML\.T\d{4}$/),
  tactic: z.string().min(1),
  title: z.string().min(1),
});
export type MitreAtlasTechniqueRef = z.infer<typeof MitreAtlasTechniqueRefSchema>;

export const AvidSubcategoryRefSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
});
export const AvidCategoryRefSchema = z.object({
  id: z.enum(['S', 'E', 'P']),
  title: z.string().min(1),
  subcategories: z.array(AvidSubcategoryRefSchema),
});
export type AvidCategoryRef = z.infer<typeof AvidCategoryRefSchema>;
export type AvidSubcategoryRef = z.infer<typeof AvidSubcategoryRefSchema>;

export const MitAiRiskSubcategoryRefSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
});
export const MitAiRiskCategoryRefSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  subcategories: z.array(MitAiRiskSubcategoryRefSchema),
});
export type MitAiRiskCategoryRef = z.infer<typeof MitAiRiskCategoryRefSchema>;
export type MitAiRiskSubcategoryRef = z.infer<typeof MitAiRiskSubcategoryRefSchema>;

export const MappingStrengthSchema = z.enum([
  'equivalent',
  'subsumes',
  'supports',
  'partial',
  'referenced_by',
]);
export type MappingStrength = z.infer<typeof MappingStrengthSchema>;

export const FrameworkNodeRefSchema = z.object({
  framework: FrameworkIdSchema,
  id: z.string().min(1),
});
export type FrameworkNodeRef = z.infer<typeof FrameworkNodeRefSchema>;

export const FrameworkMappingEdgeSchema = z.object({
  from: FrameworkNodeRefSchema,
  to: FrameworkNodeRefSchema,
  strength: MappingStrengthSchema,
  rationale: z.string().min(1),
  confidence: z.number().min(0).max(1),
});
export type FrameworkMappingEdge = z.infer<typeof FrameworkMappingEdgeSchema>;
