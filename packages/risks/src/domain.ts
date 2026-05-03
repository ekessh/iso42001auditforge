// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

export const AiRiskRegisterEntry = z.object({
  id: z.string().uuid(),
  firmId: z.string().uuid(),
  engagementId: z.string().uuid(),
  ownerOrg: z.string(),
  riskTitle: z.string(),
  description: z.string(),
  category: z.enum(['bias', 'safety', 'privacy', 'security', 'transparency', 'reliability', 'misuse', 'environmental', 'societal', 'other']),
  likelihood: z.number().int().min(1).max(5),
  impact: z.number().int().min(1).max(5),
  inherentScore: z.number().int().min(1).max(25),
  controls: z.array(z.string()).default([]),
  residualScore: z.number().int().min(1).max(25).optional(),
  treatmentPlan: z.string().optional(),
});
export type AiRiskRegisterEntry = z.infer<typeof AiRiskRegisterEntry>;

export const RiskReview = z.object({
  id: z.string().uuid(),
  riskEntryId: z.string().uuid(),
  reviewerId: z.string().uuid(),
  reviewedAt: z.string().datetime(),
  verdict: z.enum(['confirm', 'dispute', 'raise_nc', 'na']),
  comments: z.string().optional(),
});
export type RiskReview = z.infer<typeof RiskReview>;

export const ImpactAssessment = z.object({
  id: z.string().uuid(),
  firmId: z.string().uuid(),
  engagementId: z.string().uuid(),
  aiSystemId: z.string().uuid(),
  preparedBy: z.string(),
  preparedAt: z.string().datetime(),
  scope: z.string(),
  affectedStakeholders: z.array(z.string()),
  intendedBenefits: z.string(),
  potentialHarms: z.string(),
  mitigations: z.string(),
  residualRiskAssessment: z.string(),
});
export type ImpactAssessment = z.infer<typeof ImpactAssessment>;
