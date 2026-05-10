// SPDX-License-Identifier: BUSL-1.1

import { z } from 'zod';

import { apiFetch, type ApiFetchOptions } from './fetcher.js';

export const ChecklistItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['pass', 'fail', 'overridden', 'skipped']),
  reason: z.string(),
  overrideRationale: z.string().optional(),
});
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

export const ChecklistResultSchema = z.object({
  passed: z.boolean(),
  items: z.array(ChecklistItemSchema),
});
export type ChecklistResult = z.infer<typeof ChecklistResultSchema>;

export interface EvaluateBody {
  engagementId: string;
  mode: 'audit' | 'readiness';
  draft: {
    reportId: string;
    type: string;
    status: 'draft' | 'in_review' | 'signed_final' | 'archived';
    scopeStatement?: string;
    methodologyStatement?: string;
    hasMandatoryDisclaimer?: boolean;
    contentHash?: string;
  };
  findings?: { findingId: string; evidenceRefs: string[] }[];
  candidateFindings?: { candidateId: string; status: 'open' | 'promoted' | 'dismissed' }[];
  peerReview: {
    required: boolean;
    status?: 'pending' | 'in_review' | 'changes_requested' | 'approved' | 'withdrawn';
    approvedAt?: string;
    reviewerId?: string;
    securityReviewRequired?: boolean;
    securityReviewerId?: string;
    securityApprovedAt?: string;
  };
  samplingPlan?: { planId: string; documentedAt: string };
  impartiality: { declared: boolean; declaredAt?: string; declaredBy?: string };
  signing: { signingKeyId?: string; tsaAnchorId?: string };
  overrides?: Record<string, { actorId: string; rationale: string; at: string }>;
}

export function evaluate(
  body: EvaluateBody,
  options: ApiFetchOptions<EvaluateBody> = {},
) {
  return apiFetch('/qa-checklist/evaluate', ChecklistResultSchema, {
    ...options,
    method: 'POST',
    body,
  });
}

export interface OverrideBody {
  engagementId: string;
  reportId: string;
  itemId: string;
  rationale: string;
}

const OverrideAcceptedSchema = z.object({
  accepted: z.literal(true),
  itemId: z.string(),
});

export function override(
  body: OverrideBody,
  options: ApiFetchOptions<OverrideBody> = {},
) {
  return apiFetch('/qa-checklist/override', OverrideAcceptedSchema, {
    ...options,
    method: 'POST',
    body,
  });
}
