// SPDX-License-Identifier: BUSL-1.1
'use client';

import { useQuery } from '@tanstack/react-query';

import { traces, type Trace } from '@auditforge/api-client';

export function useTraces(params: { cursor?: string; limit?: number } = {}) {
  return useQuery({
    queryKey: ['traces', params],
    queryFn: ({ signal }) => traces.listTraces(params, { signal }),
  });
}

export function useTrace(id: string) {
  return useQuery<Trace>({
    queryKey: ['trace', id],
    queryFn: ({ signal }) => traces.getTrace(id, { signal }),
    enabled: Boolean(id),
  });
}
