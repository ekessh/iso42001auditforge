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

export const UpdateEngagementSchema = z.object({
  scopeStatement: z.string().min(1).max(4000).optional(),
  mode: EngagementModeSchema.optional(),
  stage: EngagementStageSchema.optional(),
  status: EngagementStatusSchema.optional(),
  startsOn: z.string().optional(),
  endsOn: z.string().optional(),
  leadAuditorId: z.string().optional(),
  teamMemberIds: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type UpdateEngagementInput = z.infer<typeof UpdateEngagementSchema>;

export function updateEngagement(
  id: string,
  body: UpdateEngagementInput,
  options: ApiFetchOptions = {},
) {
  return apiFetch(`/engagements/${encodeURIComponent(id)}`, EngagementSchema, {
    ...options,
    method: 'PATCH',
    body,
  });
}

export const AuditTrailEntrySchema = z.object({
  id: z.string(),
  engagementId: z.string(),
  kind: z.string(),
  actor: z.string().optional(),
  payload: z.record(z.unknown()).optional(),
  hashPrefix: z.string().optional(),
  createdAt: z.string(),
});
export type AuditTrailEntry = z.infer<typeof AuditTrailEntrySchema>;

export const AuditTrailPageSchema = PaginatedSchema(AuditTrailEntrySchema);

export function getAuditTrail(
  engagementId: string,
  options: ApiFetchOptions = {},
) {
  return apiFetch(
    `/engagements/${encodeURIComponent(engagementId)}/audit-trail`,
    AuditTrailPageSchema,
    options,
  );
}

export const ReportDraftSchema = z.object({
  id: z.string(),
  engagementId: z.string(),
  status: z.string(),
  generatedAt: z.string(),
  body: z.unknown(),
});
export type ReportDraft = z.infer<typeof ReportDraftSchema>;

export function generateReportDraft(
  engagementId: string,
  options: ApiFetchOptions = {},
) {
  return apiFetch('/reports/draft', ReportDraftSchema, {
    ...options,
    method: 'POST',
    body: { engagementId },
  });
}
