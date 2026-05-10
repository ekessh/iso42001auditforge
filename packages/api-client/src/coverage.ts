// SPDX-License-Identifier: BUSL-1.1

import { z } from 'zod';

import { apiFetch, type ApiFetchOptions } from './fetcher.js';

export const CoverageStatusSchema = z.enum(['evidenced', 'partial', 'contradicted', 'untouched']);
export type CoverageStatus = z.infer<typeof CoverageStatusSchema>;

export const CoverageCellSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  status: CoverageStatusSchema,
});
export type CoverageCell = z.infer<typeof CoverageCellSchema>;

export const CoverageAreaSchema = z.object({
  id: z.string(),
  title: z.string(),
  cells: z.array(CoverageCellSchema),
});
export type CoverageArea = z.infer<typeof CoverageAreaSchema>;

export function getCoverage(engagementId: string, options: ApiFetchOptions = {}) {
  return apiFetch(
    `/engagements/${encodeURIComponent(engagementId)}/coverage`,
    CoverageAreaSchema,
    options,
  );
}

export const FindingTypeBreakdownSchema = z.object({
  major: z.number().int().nonnegative(),
  minor: z.number().int().nonnegative(),
  ofi: z.number().int().nonnegative(),
  observation: z.number().int().nonnegative(),
});

export const AreaCoverageBarSchema = z.object({
  areaId: z.string(),
  areaTitle: z.string(),
  planned: z.number().int().nonnegative(),
  covered: z.number().int().nonnegative(),
});

export const ManDayPointSchema = z.object({
  day: z.number().int(),
  planned: z.number(),
  actual: z.number(),
});

export const AuditRiskFlagSchema = z.enum(['on_track', 'coverage_gap', 'time_overrun']);

export const AuditDashboardSchema = z.object({
  coveragePct: z.number(),
  areaBars: z.array(AreaCoverageBarSchema),
  manDays: z.array(ManDayPointSchema),
  manDaysSpent: z.number(),
  manDaysPlanned: z.number(),
  candidateFindings: FindingTypeBreakdownSchema,
  promotedFindings: z.number().int().nonnegative(),
  samplingCompletePct: z.number(),
  risk: AuditRiskFlagSchema,
  attentionAreas: z.array(z.object({ areaId: z.string(), reason: z.string() })),
});
export type AuditDashboard = z.infer<typeof AuditDashboardSchema>;

export function getAuditDashboard(
  engagementId: string,
  options: ApiFetchOptions = {},
) {
  return apiFetch(
    `/engagements/${encodeURIComponent(engagementId)}/dashboard/audit`,
    AuditDashboardSchema,
    options,
  );
}
