// SPDX-License-Identifier: BUSL-1.1

import { z } from 'zod';

import { apiFetch, type ApiFetchOptions } from './fetcher.js';

export const AnnexFamilySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  readinessPct: z.number(),
  evidenced: z.number().int().nonnegative(),
  partial: z.number().int().nonnegative(),
  untouched: z.number().int().nonnegative(),
  totalClauses: z.number().int().nonnegative(),
  status: z.enum(['green', 'amber', 'red', 'grey']),
});
export type AnnexFamily = z.infer<typeof AnnexFamilySchema>;

export const ReadinessTrendPointSchema = z.object({
  date: z.string(),
  readinessPct: z.number(),
  event: z.string().optional(),
});

export const BlockerSchema = z.object({
  id: z.string(),
  clauseId: z.string(),
  clauseTitle: z.string(),
  impact: z.enum(['high', 'medium', 'low']),
  recommendedAction: z.string(),
});

export const OpenItemSchema = z.object({
  id: z.string(),
  type: z.enum(['major', 'minor', 'ofi', 'observation']),
  title: z.string(),
  clauseId: z.string(),
  age: z.string(),
});

export const ReadinessAiSystemBarSchema = z.object({
  systemId: z.string(),
  systemName: z.string(),
  readinessPct: z.number(),
  weight: z.number(),
});

export const ReadinessSchema = z.object({
  overallPct: z.number(),
  trend30dDelta: z.number(),
  trend90dDelta: z.number(),
  targetCertDate: z.string(),
  daysToTarget: z.number().int(),
  families: z.array(AnnexFamilySchema),
  trend: z.array(ReadinessTrendPointSchema),
  blockers: z.array(BlockerSchema),
  openItems: z.array(OpenItemSchema),
  aiSystems: z.array(ReadinessAiSystemBarSchema),
  weights: z.object({
    mandatory: z.number(),
    annexA: z.number(),
    description: z.string(),
  }),
});
export type Readiness = z.infer<typeof ReadinessSchema>;

export function getReadiness(
  engagementId: string,
  options: ApiFetchOptions = {},
) {
  return apiFetch(
    `/engagements/${encodeURIComponent(engagementId)}/dashboard/readiness`,
    ReadinessSchema,
    options,
  );
}
