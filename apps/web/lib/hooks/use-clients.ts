// SPDX-License-Identifier: BUSL-1.1
'use client';

import { useQuery } from '@tanstack/react-query';

import { clients, type Client } from '@auditforge/api-client';

export function useClients(params: { cursor?: string; limit?: number } = {}) {
  return useQuery({
    queryKey: ['clients', params],
    queryFn: ({ signal }) => clients.listClients(params, { signal }),
  });
}

export function useClient(id: string) {
  return useQuery<Client>({
    queryKey: ['client', id],
    queryFn: ({ signal }) => clients.getClient(id, { signal }),
    enabled: Boolean(id),
  });
}
