// SPDX-License-Identifier: BUSL-1.1
/**
 * Surveillance plan domain (Phase 11 completion).
 *
 * WHY this lives here: ISO 17021-1 § 9.6 mandates the certification body define a surveillance
 * programme per certified client. The programme covers Stage-1, surveillance audits S1/S2, and
 * recertification at the 3-year cycle. Encoding the plan as data lets the API surface a timeline
 * view and lets the anomaly detector evaluate "next surveillance" cadence vs. observed change.
 */
import { z } from 'zod';

const idSchema = z.string().min(1).max(128);

const isoTimestampSchema = z
  .string()
  .min(20)
  .max(40)
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'invalid ISO-8601 timestamp' });

export const SURVEILLANCE_VISIT_KIND = [
  'stage1',
  'stage2',
  'surv1',
  'surv2',
  'recert',
  'special',
] as const;

export type SurveillanceVisitKind = (typeof SURVEILLANCE_VISIT_KIND)[number];

export const VISIT_STATUS = ['planned', 'in_progress', 'closed', 'overdue', 'cancelled'] as const;
export type VisitStatus = (typeof VISIT_STATUS)[number];

export const surveillanceVisitSchema = z
  .object({
    visitId: idSchema,
    clientId: idSchema,
    tenantId: idSchema,
    kind: z.enum(SURVEILLANCE_VISIT_KIND),
    plannedAt: isoTimestampSchema,
    plannedDurationDays: z.number().int().positive().max(60),
    status: z.enum(VISIT_STATUS),
    completedAt: isoTimestampSchema.optional(),
    leadAuditorId: idSchema.optional(),
    notes: z.string().max(2048).optional(),
  })
  .strict();

export type SurveillanceVisit = z.infer<typeof surveillanceVisitSchema>;

export const surveillancePlanSchema = z
  .object({
    planId: idSchema,
    clientId: idSchema,
    tenantId: idSchema,
    certificationStartedAt: isoTimestampSchema,
    certificationCycleYears: z.number().int().positive().max(5).default(3),
    visits: z.array(surveillanceVisitSchema).max(64),
    openNcCarryover: z
      .array(
        z
          .object({
            ncId: idSchema,
            ref: z.string().min(1).max(128),
            severity: z.enum(['minor', 'major', 'critical']),
            raisedAt: isoTimestampSchema,
          })
          .strict(),
      )
      .max(256)
      .default([]),
    complaintsLog: z
      .array(
        z
          .object({
            complaintId: idSchema,
            receivedAt: isoTimestampSchema,
            severity: z.enum(['low', 'medium', 'high', 'critical']),
            summary: z.string().min(1).max(2048),
            resolved: z.boolean(),
          })
          .strict(),
      )
      .max(512)
      .default([]),
    scopeChanges: z
      .array(
        z
          .object({
            changeId: idSchema,
            occurredAt: isoTimestampSchema,
            kind: z.enum(['system_added', 'system_removed', 'system_updated', 'site_change', 'reorg']),
            description: z.string().min(1).max(2048),
            triggersReaudit: z.boolean(),
          })
          .strict(),
      )
      .max(256)
      .default([]),
    lastUpdatedAt: isoTimestampSchema,
  })
  .strict();

export type SurveillancePlan = z.infer<typeof surveillancePlanSchema>;

export interface SurveillanceWindow {
  readonly start: string;
  readonly end: string;
}

export function nextPlannedVisit(plan: SurveillancePlan, now: Date = new Date()): SurveillanceVisit | null {
  const upcoming = plan.visits
    .filter((v) => v.status === 'planned' && Date.parse(v.plannedAt) >= now.getTime())
    .sort((a, b) => Date.parse(a.plannedAt) - Date.parse(b.plannedAt));
  return upcoming[0] ?? null;
}

export function lastClosedVisit(plan: SurveillancePlan): SurveillanceVisit | null {
  const closed = plan.visits
    .filter((v) => v.status === 'closed' && v.completedAt !== undefined)
    .sort((a, b) => Date.parse(b.completedAt!) - Date.parse(a.completedAt!));
  return closed[0] ?? null;
}

export function daysSinceLastSurveillance(
  plan: SurveillancePlan,
  now: Date = new Date(),
): number | null {
  const last = lastClosedVisit(plan);
  if (last === null) return null;
  const diffMs = now.getTime() - Date.parse(last.completedAt!);
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

export function visitsForCycle(
  startedAt: Date,
  cycleYears: number = 3,
): { kind: SurveillanceVisitKind; offsetMonths: number }[] {
  const out: { kind: SurveillanceVisitKind; offsetMonths: number }[] = [];
  out.push({ kind: 'stage1', offsetMonths: 0 });
  out.push({ kind: 'stage2', offsetMonths: 1 });
  for (let i = 1; i < cycleYears; i += 1) {
    const kind: SurveillanceVisitKind = i === 1 ? 'surv1' : 'surv2';
    out.push({ kind, offsetMonths: i * 12 });
  }
  out.push({ kind: 'recert', offsetMonths: cycleYears * 12 });
  return out;
}

export function generateDefaultPlan(input: {
  planId: string;
  clientId: string;
  tenantId: string;
  certificationStartedAt: Date;
  cycleYears?: number;
  newVisitId: () => string;
  plannedDurationDays?: number;
}): SurveillancePlan {
  const cycle = input.cycleYears ?? 3;
  const tpl = visitsForCycle(input.certificationStartedAt, cycle);
  const visits: SurveillanceVisit[] = tpl.map((v) => {
    const planned = new Date(input.certificationStartedAt.getTime());
    planned.setUTCMonth(planned.getUTCMonth() + v.offsetMonths);
    return {
      visitId: input.newVisitId(),
      clientId: input.clientId,
      tenantId: input.tenantId,
      kind: v.kind,
      plannedAt: planned.toISOString(),
      plannedDurationDays: input.plannedDurationDays ?? 2,
      status: 'planned' as const,
    };
  });
  return surveillancePlanSchema.parse({
    planId: input.planId,
    clientId: input.clientId,
    tenantId: input.tenantId,
    certificationStartedAt: input.certificationStartedAt.toISOString(),
    certificationCycleYears: cycle,
    visits,
    openNcCarryover: [],
    complaintsLog: [],
    scopeChanges: [],
    lastUpdatedAt: new Date().toISOString(),
  });
}
