// SPDX-License-Identifier: BUSL-1.1

import { z } from 'zod';

import { apiFetch, type ApiFetchOptions } from './fetcher.js';

export const CandidateFindingTypeSchema = z.enum(['major', 'minor', 'ofi', 'observation']);
export type CandidateFindingType = z.infer<typeof CandidateFindingTypeSchema>;

export const CandidateFindingConfidenceSchema = z.enum(['low', 'medium', 'high']);

export const ClauseChipSchema = z.object({
  id: z.string(),
  label: z.string(),
});

export const CandidateFindingSchema = z.object({
  id: z.string(),
  type: CandidateFindingTypeSchema,
  typeLabel: z.string(),
  statement: z.string(),
  clauses: z.array(ClauseChipSchema),
  confidence: CandidateFindingConfidenceSchema,
  source: z.string(),
  claimRefs: z.array(z.string()).default([]),
  parked: z.boolean().default(false),
});
export type CandidateFinding = z.infer<typeof CandidateFindingSchema>;

export function listCandidateFindings(
  engagementId: string,
  options: ApiFetchOptions = {},
) {
  return apiFetch(
    `/engagements/${encodeURIComponent(engagementId)}/candidate-findings`,
    z.array(CandidateFindingSchema),
    options,
  );
}

export const PromoteCandidateFindingSchema = z.object({
  candidateFindingId: z.string(),
  severity: z.enum(['major_nc', 'minor_nc', 'ofi', 'conformity']),
  title: z.string().min(1).max(400),
  description: z.string().min(1).max(8000),
});
export type PromoteCandidateFindingInput = z.infer<typeof PromoteCandidateFindingSchema>;

export function promoteCandidateFinding(
  engagementId: string,
  body: PromoteCandidateFindingInput,
  options: ApiFetchOptions = {},
) {
  return apiFetch(
    `/engagements/${encodeURIComponent(engagementId)}/candidate-findings/promote`,
    z.object({ findingId: z.string() }),
    {
      ...options,
      method: 'POST',
      body,
    },
  );
}
