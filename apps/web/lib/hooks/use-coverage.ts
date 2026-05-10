// SPDX-License-Identifier: BUSL-1.1
'use client';

import { useQuery } from '@tanstack/react-query';

import { coverage, readiness as readinessApi } from '@auditforge/api-client';
import type { CoverageArea, AuditDashboard, Readiness } from '@auditforge/api-client';

export function useCoverage(engagementId: string) {
  return useQuery<CoverageArea>({
    queryKey: ['coverage', engagementId],
    queryFn: ({ signal }) => coverage.getCoverage(engagementId, { signal }),
    enabled: Boolean(engagementId),
    staleTime: 30_000,
  });
}

export function useReadiness(engagementId: string) {
  return useQuery<Readiness>({
    queryKey: ['readiness', engagementId],
    queryFn: ({ signal }) => readinessApi.getReadiness(engagementId, { signal }),
    enabled: Boolean(engagementId),
    staleTime: 60_000,
  });
}

export function useAuditDashboard(engagementId: string) {
  return useQuery<AuditDashboard>({
    queryKey: ['audit-dashboard', engagementId],
    queryFn: ({ signal }) => coverage.getAuditDashboard(engagementId, { signal }),
    enabled: Boolean(engagementId),
    staleTime: 30_000,
  });
}
