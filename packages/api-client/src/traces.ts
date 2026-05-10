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

export interface UploadTraceInput {
  file: File;
  name?: string;
  engagementId?: string;
}

export async function uploadTrace(
  input: UploadTraceInput,
  options: ApiFetchOptions = {},
): Promise<Trace> {
  const form = new FormData();
  form.append('file', input.file);
  if (input.name) form.append('name', input.name);
  if (input.engagementId) form.append('engagementId', input.engagementId);

  const { getApiBaseUrl } = await import('./fetcher.js');
  const base = options.baseUrl ?? getApiBaseUrl();
  const url = `${base.endsWith('/') ? base.slice(0, -1) : base}/v1/traces`;

  const init: RequestInit = {
    method: 'POST',
    body: form,
    credentials: 'include',
  };
  if (options.signal) init.signal = options.signal;
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Upload failed: HTTP ${res.status}`);
  }
  const data = await res.json();
  return TraceSchema.parse(data);
}
