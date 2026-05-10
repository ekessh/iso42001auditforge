// SPDX-License-Identifier: BUSL-1.1

import { z } from 'zod';

import { apiFetch, PaginatedSchema, type ApiFetchOptions } from './fetcher.js';

export const ClientSchema = z.object({
  id: z.string(),
  firmId: z.string(),
  name: z.string(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Client = z.infer<typeof ClientSchema>;

export const ClientPageSchema = PaginatedSchema(ClientSchema);

export interface ListClientsParams {
  cursor?: string;
  limit?: number;
}

export function listClients(
  params: ListClientsParams = {},
  options: ApiFetchOptions = {},
) {
  return apiFetch('/clients', ClientPageSchema, {
    ...options,
    query: { cursor: params.cursor, limit: params.limit },
  });
}

export function getClient(id: string, options: ApiFetchOptions = {}) {
  return apiFetch(`/clients/${encodeURIComponent(id)}`, ClientSchema, options);
}
