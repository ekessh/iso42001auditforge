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

export const CreateClientSchema = z.object({
  name: z.string().min(1).max(200),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateClientInput = z.infer<typeof CreateClientSchema>;

export function createClient(body: CreateClientInput, options: ApiFetchOptions = {}) {
  return apiFetch('/clients', ClientSchema, {
    ...options,
    method: 'POST',
    body,
  });
}

export const UpdateClientSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type UpdateClientInput = z.infer<typeof UpdateClientSchema>;

export function updateClient(
  id: string,
  body: UpdateClientInput,
  options: ApiFetchOptions = {},
) {
  return apiFetch(`/clients/${encodeURIComponent(id)}`, ClientSchema, {
    ...options,
    method: 'PATCH',
    body,
  });
}

/**
 * Soft-delete a client. Uses DELETE semantics (the mock + production server
 * both treat this as soft archival; no body returned on 204).
 */
export async function archiveClient(id: string, options: ApiFetchOptions = {}): Promise<void> {
  const { apiFetchRaw } = await import('./fetcher.js');
  await apiFetchRaw<void>(`/clients/${encodeURIComponent(id)}`, {
    ...options,
    method: 'DELETE',
  });
}
