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
