// SPDX-License-Identifier: BUSL-1.1
/**
 * Surveillance timeline projection.
 *
 * Composes a `SurveillancePlan` with the latest closed audit summary, open NC carryover, anomaly
 * flags, and the next planned trigger. Pure function so the API endpoint is trivially testable.
 */
import type { SurveillanceFlag } from './anomaly-detector.js';
import type { SurveillancePlan, SurveillanceVisit } from './surveillance-plan.js';
import {
  daysSinceLastSurveillance,
  lastClosedVisit,
  nextPlannedVisit,
} from './surveillance-plan.js';

export interface AuditSummary {
  readonly visitId: string;
  readonly kind: string;
  readonly completedAt: string;
  readonly conformity: 'conformant' | 'minor_nc' | 'major_nc' | 'mixed';
  readonly findingsCount: number;
}

export interface SurveillanceTimeline {
  readonly clientId: string;
  readonly tenantId: string;
  readonly schedule: ReadonlyArray<SurveillanceVisit>;
  readonly nextVisit: SurveillanceVisit | null;
  readonly lastVisit: SurveillanceVisit | null;
  readonly daysSinceLastSurveillance: number | null;
  readonly lastAuditSummary: AuditSummary | null;
  readonly openNcCarryover: ReadonlyArray<{ ncId: string; ref: string; severity: string; raisedAt: string }>;
  readonly anomalyFlags: ReadonlyArray<SurveillanceFlag>;
  readonly upcomingReauditTriggers: ReadonlyArray<{ changeId: string; kind: string; occurredAt: string }>;
  readonly generatedAt: string;
}

export interface ProjectTimelineInput {
  readonly plan: SurveillancePlan;
  readonly flags: ReadonlyArray<SurveillanceFlag>;
  readonly auditSummary?: AuditSummary;
  readonly now?: Date;
}

export function projectTimeline(input: ProjectTimelineInput): SurveillanceTimeline {
  const now = input.now ?? new Date();
  const upcomingTriggers = input.plan.scopeChanges
    .filter((c) => c.triggersReaudit)
    .map((c) => ({ changeId: c.changeId, kind: c.kind, occurredAt: c.occurredAt }));

  return {
    clientId: input.plan.clientId,
    tenantId: input.plan.tenantId,
    schedule: input.plan.visits,
    nextVisit: nextPlannedVisit(input.plan, now),
    lastVisit: lastClosedVisit(input.plan),
    daysSinceLastSurveillance: daysSinceLastSurveillance(input.plan, now),
    lastAuditSummary: input.auditSummary ?? null,
    openNcCarryover: input.plan.openNcCarryover,
    anomalyFlags: input.flags,
    upcomingReauditTriggers: upcomingTriggers,
    generatedAt: now.toISOString(),
  };
}
