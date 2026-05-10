// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect } from 'vitest';

import { generateDefaultPlan, surveillancePlanSchema } from '../src/surveillance-plan.js';
import { projectTimeline } from '../src/timeline.js';

let counter = 0;
const newId = (): string => `id-${++counter}`;

describe('surveillance timeline projection', () => {
  it('projects schedule + flags + open NC + triggers', () => {
    const plan = surveillancePlanSchema.parse({
      ...generateDefaultPlan({
        planId: 'p1',
        clientId: 'c1',
        tenantId: 't1',
        certificationStartedAt: new Date('2026-01-01T00:00:00Z'),
        newVisitId: newId,
      }),
      openNcCarryover: [
        { ncId: 'nc-1', ref: 'A.6.1.2', severity: 'minor', raisedAt: '2026-02-01T00:00:00Z' },
      ],
      scopeChanges: [
        {
          changeId: 'sc-1',
          occurredAt: '2026-04-01T00:00:00Z',
          kind: 'system_added',
          description: 'new agent added',
          triggersReaudit: true,
        },
      ],
    });

    const timeline = projectTimeline({
      plan,
      flags: [],
      now: new Date('2026-05-10T00:00:00Z'),
    });
    expect(timeline.schedule.length).toBe(5);
    expect(timeline.openNcCarryover.length).toBe(1);
    expect(timeline.upcomingReauditTriggers.length).toBe(1);
    expect(timeline.upcomingReauditTriggers[0]?.changeId).toBe('sc-1');
  });

  it('reports daysSinceLastSurveillance based on lastClosedVisit', () => {
    const plan = generateDefaultPlan({
      planId: 'p1',
      clientId: 'c1',
      tenantId: 't1',
      certificationStartedAt: new Date('2025-01-01T00:00:00Z'),
      newVisitId: newId,
    });
    const v0 = plan.visits[0]!;
    const closedPlan = surveillancePlanSchema.parse({
      ...plan,
      visits: [
        { ...v0, status: 'closed', completedAt: '2025-12-01T00:00:00Z' },
        ...plan.visits.slice(1),
      ],
    });
    const timeline = projectTimeline({
      plan: closedPlan,
      flags: [],
      now: new Date('2026-05-10T00:00:00Z'),
    });
    expect(timeline.daysSinceLastSurveillance).toBeGreaterThan(150);
  });
});
