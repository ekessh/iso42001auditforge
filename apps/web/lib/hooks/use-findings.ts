// SPDX-License-Identifier: BUSL-1.1
'use client';

import { useQuery } from '@tanstack/react-query';

import { findings, type Finding } from '@auditforge/api-client';

export interface UseFindingsParams {
  engagementId?: string;
  cursor?: string;
  limit?: number;
}

export function useFindings(params: UseFindingsParams = {}) {
  return useQuery({
    queryKey: ['findings', params],
    queryFn: ({ signal }) => findings.listFindings(params, { signal }),
  });
}

export function useFinding(id: string) {
  return useQuery<Finding>({
    queryKey: ['finding', id],
    queryFn: ({ signal }) => findings.getFinding(id, { signal }),
    enabled: Boolean(id),
  });
}
