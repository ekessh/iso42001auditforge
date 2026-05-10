// SPDX-License-Identifier: BUSL-1.1

import { z } from 'zod';

import { apiFetch, PaginatedSchema, type ApiFetchOptions } from './fetcher.js';

export const FindingSeveritySchema = z.enum(['major_nc', 'minor_nc', 'ofi', 'conformity']);
export type FindingSeverity = z.infer<typeof FindingSeveritySchema>;

export const FindingStatusSchema = z.enum([
  'open',
  'capa_pending',
  'capa_in_progress',
  'closed',
  'verified',
]);
export type FindingStatus = z.infer<typeof FindingStatusSchema>;

export const FindingSchema = z.object({
  id: z.string(),
  firmId: z.string(),
  engagementId: z.string(),
  controlRef: z.string(),
  severity: FindingSeveritySchema,
  title: z.string(),
  description: z.string(),
  evidence: z.array(z.string()).default([]),
  status: FindingStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Finding = z.infer<typeof FindingSchema>;

export const FindingPageSchema = PaginatedSchema(FindingSchema);

export interface ListFindingsParams {
  cursor?: string;
  limit?: number;
  engagementId?: string;
}

export function listFindings(
  params: ListFindingsParams = {},
  options: ApiFetchOptions = {},
) {
  return apiFetch('/findings', FindingPageSchema, {
    ...options,
    query: {
      cursor: params.cursor,
      limit: params.limit,
      engagementId: params.engagementId,
    },
  });
}

export function getFinding(id: string, options: ApiFetchOptions = {}) {
  return apiFetch(`/findings/${encodeURIComponent(id)}`, FindingSchema, options);
}

export const CreateFindingSchema = z.object({
  engagementId: z.string(),
  controlRef: z.string().min(1),
  severity: FindingSeveritySchema,
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(8000),
  evidence: z.array(z.string()).default([]),
});
export type CreateFindingInput = z.infer<typeof CreateFindingSchema>;

export function createFinding(
  body: CreateFindingInput,
  options: ApiFetchOptions = {},
) {
  return apiFetch('/findings', FindingSchema, {
    ...options,
    method: 'POST',
    body,
  });
}

export const UpdateFindingSchema = z.object({
  controlRef: z.string().optional(),
  severity: FindingSeveritySchema.optional(),
  status: FindingStatusSchema.optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  evidence: z.array(z.string()).optional(),
});
export type UpdateFindingInput = z.infer<typeof UpdateFindingSchema>;

export function updateFinding(
  id: string,
  body: UpdateFindingInput,
  options: ApiFetchOptions = {},
) {
  return apiFetch(`/findings/${encodeURIComponent(id)}`, FindingSchema, {
    ...options,
    method: 'PATCH',
    body,
  });
}

export function promoteFinding(id: string, options: ApiFetchOptions = {}) {
  return apiFetch(`/findings/${encodeURIComponent(id)}/promote`, FindingSchema, {
    ...options,
    method: 'POST',
    body: {},
  });
}

export const CapaFindingSchema = z.object({
  capaSummary: z.string().min(1).max(4000),
});
export type CapaFindingInput = z.infer<typeof CapaFindingSchema>;

export function recordCapa(
  id: string,
  body: CapaFindingInput,
  options: ApiFetchOptions = {},
) {
  return apiFetch(`/findings/${encodeURIComponent(id)}/capa`, FindingSchema, {
    ...options,
    method: 'POST',
    body,
  });
}
