// SPDX-License-Identifier: BUSL-1.1

import { z } from 'zod';

import { apiFetch, PaginatedSchema, type ApiFetchOptions } from './fetcher.js';

export const EvidenceRefSchema = z.object({
  kind: z.enum(['evidence', 'probe', 'trace', 'interview', 'sample']),
  id: z.string(),
});
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;

export const WorkingPaperStatusSchema = z.enum(['draft', 'in_review', 'final']);
export type WorkingPaperStatus = z.infer<typeof WorkingPaperStatusSchema>;

export const WorkingPaperSchema = z.object({
  id: z.string(),
  firmId: z.string(),
  engagementId: z.string(),
  templateId: z.string().optional(),
  title: z.string(),
  controlRef: z.string(),
  bodyMarkdown: z.string(),
  evidenceRefs: z.array(EvidenceRefSchema),
  status: WorkingPaperStatusSchema,
  version: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type WorkingPaper = z.infer<typeof WorkingPaperSchema>;

export const WorkingPaperPageSchema = PaginatedSchema(WorkingPaperSchema);

export interface ListWorkingPapersParams {
  cursor?: string;
  limit?: number;
  engagementId?: string;
}

export function listWorkingPapers(
  params: ListWorkingPapersParams = {},
  options: ApiFetchOptions = {},
) {
  return apiFetch('/working-papers', WorkingPaperPageSchema, {
    ...options,
    query: {
      cursor: params.cursor,
      limit: params.limit,
      engagementId: params.engagementId,
    },
  });
}

export function getWorkingPaper(id: string, options: ApiFetchOptions = {}) {
  return apiFetch(
    `/working-papers/${encodeURIComponent(id)}`,
    WorkingPaperSchema,
    options,
  );
}

export const CreateWorkingPaperSchema = z.object({
  engagementId: z.string(),
  controlRef: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  bodyMarkdown: z.string().default(''),
  templateId: z.string().optional(),
  evidenceRefs: z.array(EvidenceRefSchema).default([]),
});
export type CreateWorkingPaperInput = z.infer<typeof CreateWorkingPaperSchema>;

export function createWorkingPaper(
  body: CreateWorkingPaperInput,
  options: ApiFetchOptions = {},
) {
  return apiFetch('/working-papers', WorkingPaperSchema, {
    ...options,
    method: 'POST',
    body,
  });
}

export const UpdateWorkingPaperSchema = z.object({
  title: z.string().optional(),
  bodyMarkdown: z.string().optional(),
  status: WorkingPaperStatusSchema.optional(),
  evidenceRefs: z.array(EvidenceRefSchema).optional(),
});
export type UpdateWorkingPaperInput = z.infer<typeof UpdateWorkingPaperSchema>;

export function updateWorkingPaper(
  id: string,
  body: UpdateWorkingPaperInput,
  options: ApiFetchOptions = {},
) {
  return apiFetch(
    `/working-papers/${encodeURIComponent(id)}`,
    WorkingPaperSchema,
    {
      ...options,
      method: 'PATCH',
      body,
    },
  );
}
