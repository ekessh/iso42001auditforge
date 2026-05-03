// SPDX-License-Identifier: BUSL-1.1
'use client';

/**
 * useCandidateFindings — TanStack Query hook for the right-pane candidate
 * finding stream. Pulls from the same workspace mock; in production this
 * will be an SSE/WebSocket-backed query that re-fetches on Coverage State
 * notifications.
 */

import { useQuery } from '@tanstack/react-query';

import {
  buildWorkspaceMock,
  type CandidateFinding,
} from '@/lib/mocks/workspace-mock';

export function useCandidateFindings(engagementId: string) {
  return useQuery<CandidateFinding[]>({
    queryKey: ['candidate-findings', engagementId],
    queryFn: async () => {
      await new Promise((r) => setTimeout(r, 60));
      return buildWorkspaceMock(engagementId).candidateFindings;
    },
    staleTime: 15_000,
  });
}
