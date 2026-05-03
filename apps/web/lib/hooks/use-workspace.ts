// SPDX-License-Identifier: BUSL-1.1
'use client';

/**
 * useWorkspace — TanStack Query hook returning the workspace bundle for an
 * engagement: context, messages, findings, claims, coverage area.
 *
 * Backed by `buildWorkspaceMock` until the Conversational Audit Engine API is
 * wired in Phase 7.6. The query key intentionally includes the mode so that
 * Audit-Mode and Readiness-Mode views of the same engagement are cached
 * independently.
 */

import { useQuery } from '@tanstack/react-query';

import {
  buildWorkspaceMock,
  type EngagementMode,
  type WorkspaceMock,
} from '@/lib/mocks/workspace-mock';

export function useWorkspace(
  engagementId: string,
  mode: EngagementMode = 'audit',
) {
  return useQuery<WorkspaceMock>({
    queryKey: ['workspace', engagementId, mode],
    queryFn: async () => {
      // Simulate a tiny network delay to exercise skeleton loaders.
      await new Promise((r) => setTimeout(r, 80));
      return buildWorkspaceMock(engagementId, mode);
    },
    staleTime: 60_000,
  });
}
