// SPDX-License-Identifier: BUSL-1.1
'use client';

import { useQuery } from '@tanstack/react-query';

import { engagements, type Engagement } from '@auditforge/api-client';

export function useEngagement(id: string) {
  return useQuery<Engagement>({
    queryKey: ['engagement', id],
    queryFn: ({ signal }) => engagements.getEngagement(id, { signal }),
    enabled: Boolean(id),
  });
}

export function useEngagements(params: { cursor?: string; limit?: number } = {}) {
  return useQuery({
    queryKey: ['engagements', params],
    queryFn: ({ signal }) => engagements.listEngagements(params, { signal }),
  });
}
