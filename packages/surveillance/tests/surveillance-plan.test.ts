// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect } from 'vitest';

import {
  generateDefaultPlan,
  daysSinceLastSurveillance,
  lastClosedVisit,
  nextPlannedVisit,
  surveillancePlanSchema,
  visitsForCycle,
} from '../src/surveillance-plan.js';

let counter = 0;
const newId = (): string => `id-${++counter}`;

describe('surveillance plan', () => {
  it('generates a 3-year cycle with stage1, stage2, surv1, surv2, recert', () => {
    const start = new Date('2026-01-15T00:00:00Z');
    const plan = generateDefaultPlan({
      planId: 'p1',
      clientId: 'c1',
      tenantId: 't1',
      certificationStartedAt: start,
      newVisitId: newId,
    });
    const kinds = plan.visits.map((v) => v.kind);
    expect(kinds).toEqual(['stage1', 'stage2', 'surv1', 'surv2', 'recert']);
    expect(plan.certificationCycleYears).toBe(3);
  });

  it('all generated visits start as planned', () => {
    const start = new Date('2026-01-15T00:00:00Z');
    const plan = generateDefaultPlan({
      planId: 'p1',
      clientId: 'c1',
      tenantId: 't1',
      certificationStartedAt: start,
      newVisitId: newId,
    });
    for (const v of plan.visits) expect(v.status).toBe('planned');
  });

  it('schema rejects malformed plan', () => {
    expect(() =>
      surveillancePlanSchema.parse({
        planId: '',
        clientId: 'c',
        tenantId: 't',
        certificationStartedAt: 'not-a-date',
        certificationCycleYears: 3,
        visits: [],
        lastUpdatedAt: new Date().toISOString(),
      }),
    ).toThrow();
  });

  it('nextPlannedVisit picks the closest future visit', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const plan = generateDefaultPlan({
      planId: 'p1',
      clientId: 'c1',
      tenantId: 't1',
      certificationStartedAt: start,
      newVisitId: newId,
    });
    const next = nextPlannedVisit(plan, new Date('2026-06-01T00:00:00Z'));
    expect(next).not.toBeNull();
    expect(next?.kind).toBe('surv1');
  });

  it('lastClosedVisit returns most-recent completed', () => {
    const plan = generateDefaultPlan({
      planId: 'p1',
      clientId: 'c1',
      tenantId: 't1',
      certificationStartedAt: new Date('2025-01-01T00:00:00Z'),
      newVisitId: newId,
    });
    const v0 = plan.visits[0]!;
    const v1 = plan.visits[1]!;
    const closed = surveillancePlanSchema.parse({
      ...plan,
      visits: [
        { ...v0, status: 'closed', completedAt: '2025-02-01T00:00:00Z' },
        { ...v1, status: 'closed', completedAt: '2025-03-01T00:00:00Z' },
        ...plan.visits.slice(2),
      ],
    });
    const last = lastClosedVisit(closed);
    expect(last?.completedAt).toBe('2025-03-01T00:00:00Z');
  });

  it('daysSinceLastSurveillance returns null when no closed visit', () => {
    const plan = generateDefaultPlan({
      planId: 'p1',
      clientId: 'c1',
      tenantId: 't1',
      certificationStartedAt: new Date('2026-01-01T00:00:00Z'),
      newVisitId: newId,
    });
    expect(daysSinceLastSurveillance(plan, new Date('2026-04-01T00:00:00Z'))).toBeNull();
  });

  it('visitsForCycle scales linearly with cycleYears', () => {
    const t = visitsForCycle(new Date(), 3);
    expect(t.length).toBe(5);
    const t2 = visitsForCycle(new Date(), 4);
    expect(t2.length).toBe(6);
  });
});
