// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect } from 'vitest';

import { detectAnomalies } from '../src/anomaly-detector.js';
import {
  generateDefaultPlan,
  surveillancePlanSchema,
  type SurveillancePlan,
} from '../src/surveillance-plan.js';

let counter = 0;
const newId = (): string => `id-${++counter}`;
const newFlagId = (): string => `flag-${++counter}`;

const basePlan = (): SurveillancePlan => {
  return generateDefaultPlan({
    planId: 'p1',
    clientId: 'c1',
    tenantId: 't1',
    certificationStartedAt: new Date('2024-01-01T00:00:00Z'),
    newVisitId: newId,
  });
};

describe('anomaly detector', () => {
  it('fires scope_expansion_without_recent_survey when expansion >= 20% and no recent survey', () => {
    const plan = basePlan();
    const flags = detectAnomalies({
      plan,
      ctx: { recentScopeChangePct: 25 },
      now: new Date('2026-05-10T00:00:00Z'),
      newFlagId,
    });
    const fired = flags.find((f) => f.ruleId === 'scope_expansion_without_recent_survey');
    expect(fired).toBeDefined();
    expect(fired?.severity).toBe('critical');
    expect(fired?.suggestedAction).toBe('schedule_special_audit');
  });

  it('does NOT fire scope_expansion when survey recent', () => {
    const plan = basePlan();
    const v0 = plan.visits[0]!;
    const recentClosed = surveillancePlanSchema.parse({
      ...plan,
      visits: [
        { ...v0, status: 'closed' as const, completedAt: '2026-04-01T00:00:00Z' },
        ...plan.visits.slice(1),
      ],
    });
    const flags = detectAnomalies({
      plan: recentClosed,
      ctx: { recentScopeChangePct: 25 },
      now: new Date('2026-05-10T00:00:00Z'),
      newFlagId,
    });
    expect(flags.find((f) => f.ruleId === 'scope_expansion_without_recent_survey')).toBeUndefined();
  });

  it('fires overdue_planned_visit when planned date passed grace window', () => {
    const plan = basePlan();
    const flags = detectAnomalies({
      plan,
      ctx: {},
      now: new Date('2026-05-10T00:00:00Z'),
      newFlagId,
    });
    const overdue = flags.filter((f) => f.ruleId === 'overdue_planned_visit');
    expect(overdue.length).toBeGreaterThan(0);
  });

  it('fires unresolved_critical_complaint', () => {
    const plan = basePlan();
    const augmented = surveillancePlanSchema.parse({
      ...plan,
      complaintsLog: [
        {
          complaintId: 'c-1',
          receivedAt: '2026-04-01T00:00:00Z',
          severity: 'critical' as const,
          summary: 'safety incident',
          resolved: false,
        },
      ],
    });
    const flags = detectAnomalies({
      plan: augmented,
      ctx: {},
      now: new Date('2026-05-10T00:00:00Z'),
      newFlagId,
    });
    expect(flags.find((f) => f.ruleId === 'unresolved_critical_complaint')).toBeDefined();
  });

  it('fires high_severity_open_nc for major and critical', () => {
    const plan = basePlan();
    const augmented = surveillancePlanSchema.parse({
      ...plan,
      openNcCarryover: [
        { ncId: 'nc-1', ref: 'A.6.1.2', severity: 'major' as const, raisedAt: '2026-01-01T00:00:00Z' },
      ],
    });
    const flags = detectAnomalies({
      plan: augmented,
      ctx: {},
      now: new Date('2026-05-10T00:00:00Z'),
      newFlagId,
    });
    expect(flags.find((f) => f.ruleId === 'high_severity_open_nc')).toBeDefined();
  });

  it('fires reaudit_trigger_change for triggersReaudit=true', () => {
    const plan = basePlan();
    const augmented = surveillancePlanSchema.parse({
      ...plan,
      scopeChanges: [
        {
          changeId: 'sc-1',
          occurredAt: '2026-05-01T00:00:00Z',
          kind: 'system_added' as const,
          description: 'added new agent',
          triggersReaudit: true,
        },
      ],
    });
    const flags = detectAnomalies({
      plan: augmented,
      ctx: {},
      now: new Date('2026-05-10T00:00:00Z'),
      newFlagId,
    });
    const fired = flags.find((f) => f.ruleId === 'reaudit_trigger_change');
    expect(fired).toBeDefined();
    expect(fired?.severity).toBe('critical');
  });

  it('fires silent_telemetry_stream after threshold hours', () => {
    const plan = basePlan();
    const flags = detectAnomalies({
      plan,
      ctx: { silentStreamSince: '2026-05-05T00:00:00Z' },
      now: new Date('2026-05-10T00:00:00Z'),
      newFlagId,
    });
    expect(flags.find((f) => f.ruleId === 'silent_telemetry_stream')).toBeDefined();
  });

  it('does NOT fire silent_telemetry_stream below threshold', () => {
    const plan = basePlan();
    const flags = detectAnomalies({
      plan,
      ctx: { silentStreamSince: '2026-05-09T22:00:00Z' },
      now: new Date('2026-05-10T00:00:00Z'),
      newFlagId,
    });
    expect(flags.find((f) => f.ruleId === 'silent_telemetry_stream')).toBeUndefined();
  });

  it('fires rapid_repeat_critical_alerts at threshold', () => {
    const plan = basePlan();
    const flags = detectAnomalies({
      plan,
      ctx: { recentCriticalAlertCount: 5, recentCriticalAlertWindowDays: 7 },
      now: new Date('2026-05-10T00:00:00Z'),
      newFlagId,
    });
    expect(flags.find((f) => f.ruleId === 'rapid_repeat_critical_alerts')).toBeDefined();
  });

  it('returns no flags on a healthy plan', () => {
    const plan = basePlan();
    const v0 = plan.visits[0]!;
    const v1 = plan.visits[1]!;
    const v2 = plan.visits[2]!;
    const v3 = plan.visits[3]!;
    const v4 = plan.visits[4]!;
    const futurePlan = surveillancePlanSchema.parse({
      ...plan,
      visits: [
        { ...v0, status: 'closed' as const, completedAt: '2026-04-01T00:00:00Z' },
        { ...v1, status: 'closed' as const, completedAt: '2026-04-15T00:00:00Z' },
        { ...v2, plannedAt: '2027-01-01T00:00:00Z' },
        { ...v3, plannedAt: '2028-01-01T00:00:00Z' },
        { ...v4, plannedAt: '2029-01-01T00:00:00Z' },
      ],
    });
    const flags = detectAnomalies({
      plan: futurePlan,
      ctx: {},
      now: new Date('2026-05-10T00:00:00Z'),
      newFlagId,
    });
    expect(flags.length).toBe(0);
  });
});
