// SPDX-License-Identifier: BUSL-1.1
'use client';

import { useQuery } from '@tanstack/react-query';

import { probes, type ProbeDefinition } from '@auditforge/api-client';

export function useProbes(params: { cursor?: string; limit?: number } = {}) {
  return useQuery({
    queryKey: ['probes', params],
    queryFn: ({ signal }) => probes.listProbes(params, { signal }),
  });
}

export function useProbe(id: string) {
  return useQuery<ProbeDefinition>({
    queryKey: ['probe', id],
    queryFn: ({ signal }) => probes.getProbe(id, { signal }),
    enabled: Boolean(id),
  });
}

export function useProbeExecutions(engagementId: string) {
  return useQuery({
    queryKey: ['probe-executions', engagementId],
    queryFn: ({ signal }) => probes.listProbeExecutions(engagementId, { signal }),
    enabled: Boolean(engagementId),
  });
}
