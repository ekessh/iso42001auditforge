// SPDX-License-Identifier: BUSL-1.1

import { z } from 'zod';

import { apiFetch, PaginatedSchema, type ApiFetchOptions } from './fetcher.js';

export const TraceSchema = z.object({
  id: z.string(),
  firmId: z.string(),
  name: z.string(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Trace = z.infer<typeof TraceSchema>;

export const TracePageSchema = PaginatedSchema(TraceSchema);

export interface ListTracesParams {
  cursor?: string;
  limit?: number;
}

export function listTraces(params: ListTracesParams = {}, options: ApiFetchOptions = {}) {
  return apiFetch('/traces', TracePageSchema, {
    ...options,
    query: { cursor: params.cursor, limit: params.limit },
  });
}

export function getTrace(id: string, options: ApiFetchOptions = {}) {
  return apiFetch(`/traces/${encodeURIComponent(id)}`, TraceSchema, options);
}
