// SPDX-License-Identifier: BUSL-1.1

import { z } from 'zod';

import { apiFetch, PaginatedSchema, type ApiFetchOptions } from './fetcher.js';

export const EngagementStageSchema = z.enum([
  'stage1',
  'stage2',
  'surveillance',
  'recertification',
  'special',
]);
export type EngagementStage = z.infer<typeof EngagementStageSchema>;

export const EngagementStatusSchema = z.enum([
  'planned',
  'in_progress',
  'reporting',
  'reviewed',
  'issued',
  'archived',
  'cancelled',
]);
export type EngagementStatus = z.infer<typeof EngagementStatusSchema>;

export const EngagementModeSchema = z.enum(['audit', 'readiness']);
export type EngagementMode = z.infer<typeof EngagementModeSchema>;

export const EngagementSchema = z.object({
  id: z.string(),
  firmId: z.string(),
  clientId: z.string(),
  mode: EngagementModeSchema,
  stage: EngagementStageSchema,
  status: EngagementStatusSchema,
  scopeStatement: z.string(),
  startsOn: z.string(),
  endsOn: z.string(),
  leadAuditorId: z.string(),
  teamMemberIds: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
  metadata: z.record(z.unknown()).optional(),
});
export type Engagement = z.infer<typeof EngagementSchema>;

export const EngagementPageSchema = PaginatedSchema(EngagementSchema);

export interface ListEngagementsParams {
  cursor?: string;
  limit?: number;
}

export function listEngagements(
  params: ListEngagementsParams = {},
  options: ApiFetchOptions = {},
) {
  return apiFetch('/engagements', EngagementPageSchema, {
    ...options,
    query: { cursor: params.cursor, limit: params.limit },
  });
}

export function getEngagement(id: string, options: ApiFetchOptions = {}) {
  return apiFetch(`/engagements/${encodeURIComponent(id)}`, EngagementSchema, options);
}

export const CreateEngagementSchema = z.object({
  clientId: z.string(),
  mode: EngagementModeSchema,
  stage: EngagementStageSchema,
  scopeStatement: z.string().min(1).max(4000),
  startsOn: z.string(),
  endsOn: z.string(),
  leadAuditorId: z.string(),
  teamMemberIds: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateEngagementInput = z.infer<typeof CreateEngagementSchema>;

export function createEngagement(
  body: CreateEngagementInput,
  options: ApiFetchOptions = {},
) {
  return apiFetch('/engagements', EngagementSchema, {
    ...options,
    method: 'POST',
    body,
  });
}
