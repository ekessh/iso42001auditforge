// SPDX-License-Identifier: BUSL-1.1
'use client';

import { useQuery } from '@tanstack/react-query';

import { candidateFindings, type CandidateFinding } from '@auditforge/api-client';

export function useCandidateFindings(engagementId: string) {
  return useQuery<CandidateFinding[]>({
    queryKey: ['candidate-findings', engagementId],
    queryFn: ({ signal }) =>
      candidateFindings.listCandidateFindings(engagementId, { signal }),
    enabled: Boolean(engagementId),
    staleTime: 15_000,
  });
}
