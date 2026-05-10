// SPDX-License-Identifier: BUSL-1.1

import { z } from 'zod';

import { apiFetch, PaginatedSchema, type ApiFetchOptions } from './fetcher.js';

export const LibraryEntryKindSchema = z.enum([
  'iso42001_clause',
  'annex_a_control',
  'eu_ai_act_article',
  'nist_ai_rmf',
  'owasp_llm',
  'mitre_atlas',
  'avid',
  'mit_air',
  'question',
]);
export type LibraryEntryKind = z.infer<typeof LibraryEntryKindSchema>;

export const LibraryEntrySchema = z.object({
  id: z.string(),
  kind: LibraryEntryKindSchema,
  ref: z.string(),
  title: z.string(),
  body: z.string().optional(),
  tags: z.array(z.string()).default([]),
});
export type LibraryEntry = z.infer<typeof LibraryEntrySchema>;

export const LibraryPageSchema = PaginatedSchema(LibraryEntrySchema);

export interface ListLibraryParams {
  cursor?: string;
  limit?: number;
  kind?: LibraryEntryKind;
  q?: string;
}

export function listLibrary(
  params: ListLibraryParams = {},
  options: ApiFetchOptions = {},
) {
  return apiFetch('/library', LibraryPageSchema, {
    ...options,
    query: {
      cursor: params.cursor,
      limit: params.limit,
      kind: params.kind,
      q: params.q,
    },
  });
}
