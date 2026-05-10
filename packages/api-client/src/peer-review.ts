// SPDX-License-Identifier: BUSL-1.1

import { z } from 'zod';

import { apiFetch, PaginatedSchema, type ApiFetchOptions } from './fetcher.js';

export const PeerReviewPackageSchema = z.object({
  id: z.string(),
  firmId: z.string(),
  name: z.string(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PeerReviewPackage = z.infer<typeof PeerReviewPackageSchema>;

export const PeerReviewPackagePageSchema = PaginatedSchema(PeerReviewPackageSchema);

export const PeerReviewCommentSchema = z.object({
  id: z.string(),
  packageId: z.string(),
  parentId: z.string().nullable(),
  authorId: z.string(),
  scope: z.union([
    z.object({ kind: z.literal('finding'), findingId: z.string() }),
    z.object({ kind: z.literal('clause'), clauseRef: z.string() }),
    z.object({ kind: z.literal('global') }),
  ]),
  body: z.string(),
  createdAt: z.string(),
  resolvedAt: z.string().optional(),
  resolvedBy: z.string().optional(),
  resolutionNote: z.string().optional(),
  flag: z.enum(['standard', 'security', 'data-protection']),
});
export type PeerReviewComment = z.infer<typeof PeerReviewCommentSchema>;

export const PeerReviewCommentListSchema = z.object({
  items: z.array(PeerReviewCommentSchema),
});

export interface ListPeerReviewParams {
  cursor?: string;
  limit?: number;
}

export function listPackages(
  params: ListPeerReviewParams = {},
  options: ApiFetchOptions = {},
) {
  return apiFetch('/peer-review', PeerReviewPackagePageSchema, {
    ...options,
    query: { cursor: params.cursor, limit: params.limit },
  });
}

export function getPackage(id: string, options: ApiFetchOptions = {}) {
  return apiFetch(`/peer-review/${encodeURIComponent(id)}`, PeerReviewPackageSchema, options);
}

export function listComments(packageId: string, options: ApiFetchOptions = {}) {
  return apiFetch(
    `/peer-review/${encodeURIComponent(packageId)}/comments`,
    PeerReviewCommentListSchema,
    options,
  );
}

export interface AddCommentBody {
  parentId: string | null;
  scope:
    | { kind: 'finding'; findingId: string }
    | { kind: 'clause'; clauseRef: string }
    | { kind: 'global' };
  body: string;
  flag?: 'standard' | 'security' | 'data-protection';
}

export function addComment(
  packageId: string,
  body: AddCommentBody,
  options: ApiFetchOptions<AddCommentBody> = {},
) {
  return apiFetch(
    `/peer-review/${encodeURIComponent(packageId)}/comments`,
    PeerReviewCommentSchema,
    { ...options, method: 'POST', body },
  );
}

export function resolveComment(
  packageId: string,
  commentId: string,
  resolutionNote: string,
  options: ApiFetchOptions<{ resolutionNote: string }> = {},
) {
  return apiFetch(
    `/peer-review/${encodeURIComponent(packageId)}/comments/${encodeURIComponent(commentId)}/resolve`,
    PeerReviewCommentSchema,
    { ...options, method: 'POST', body: { resolutionNote } },
  );
}
