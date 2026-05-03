// SPDX-License-Identifier: BUSL-1.1
'use client';

/**
 * useCoverage — TanStack Query hook for coverage state.
 *
 * Returns the per-area clause grid + readiness aggregates. Until the
 * Coverage State endpoint lands (Phase 7.6), this reads from the mock
 * fixtures that drive `useWorkspace`.
 */

import { useQuery } from '@tanstack/react-query';

import {
  buildWorkspaceMock,
  MOCK_READINESS,
  MOCK_AUDIT_DASHBOARD,
  type CoverageArea,
  type ReadinessMock,
  type AuditDashboardMock,
} from '@/lib/mocks/workspace-mock';

export function useCoverage(engagementId: string) {
  return useQuery<CoverageArea>({
    queryKey: ['coverage', engagementId],
    queryFn: async () => {
      await new Promise((r) => setTimeout(r, 60));
      return buildWorkspaceMock(engagementId).coverageArea;
    },
    staleTime: 30_000,
  });
}

export function useReadiness() {
  return useQuery<ReadinessMock>({
    queryKey: ['readiness'],
    queryFn: async () => {
      await new Promise((r) => setTimeout(r, 100));
      return MOCK_READINESS;
    },
    staleTime: 60_000,
  });
}

export function useAuditDashboard(engagementId: string) {
  return useQuery<AuditDashboardMock>({
    queryKey: ['audit-dashboard', engagementId],
    queryFn: async () => {
      await new Promise((r) => setTimeout(r, 80));
      return MOCK_AUDIT_DASHBOARD;
    },
    staleTime: 30_000,
  });
}
