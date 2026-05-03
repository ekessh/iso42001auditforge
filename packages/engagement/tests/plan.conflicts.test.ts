// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect } from 'vitest';

import { buildPlan } from '../src/plan/builder.js';
import {
  detectPlanConflicts,
  applyPlanMove,
} from '../src/plan/conflicts.js';
import type { PlanSession } from '../src/types/plan.js';
import type { AuditEventId, AuditorId, EngagementId } from '@auditforge/shared';

const AUDITOR_A = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa' as unknown as AuditorId;
const AUDITOR_B = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb' as unknown as AuditorId;
const ENG = 'cccccccc-cccc-4ccc-cccc-cccccccccccc' as unknown as EngagementId;
const EVT = 'dddddddd-dddd-4ddd-dddd-dddddddddddd' as unknown as AuditEventId;

function session(overrides: Partial<PlanSession>): PlanSession {
  return {
    id: 's-1',
    start: '2026-05-04T09:00:00Z',
    end: '2026-05-04T10:00:00Z',
    kind: 'area',
    area: 'Clause 6',
    auditorIds: [AUDITOR_A],
    attendees: ['CEO'],
    ...overrides,
  };
}

describe('detectPlanConflicts — auditor double-booking', () => {
  it('returns AUDITOR_DOUBLE_BOOKED for overlapping sessions', () => {
    const plan = buildPlan({
      engagementId: ENG,
      auditEventId: EVT,
      sessions: [
        session({ id: 's1', start: '2026-05-04T09:00:00Z', end: '2026-05-04T11:00:00Z' }),
        session({ id: 's2', start: '2026-05-04T10:00:00Z', end: '2026-05-04T12:00:00Z' }),
      ],
    });
    const conflicts = detectPlanConflicts(plan);
    expect(conflicts.some((c) => c.code === 'AUDITOR_DOUBLE_BOOKED')).toBe(true);
  });

  it('does not flag adjacent (touching but not overlapping) sessions', () => {
    const plan = buildPlan({
      engagementId: ENG,
      auditEventId: EVT,
      sessions: [
        session({ id: 's1', start: '2026-05-04T09:00:00Z', end: '2026-05-04T10:00:00Z' }),
        session({ id: 's2', start: '2026-05-04T10:00:00Z', end: '2026-05-04T11:00:00Z' }),
      ],
    });
    const conflicts = detectPlanConflicts(plan);
    expect(conflicts.some((c) => c.code === 'AUDITOR_DOUBLE_BOOKED')).toBe(false);
  });

  it('different auditors can run in parallel', () => {
    const plan = buildPlan({
      engagementId: ENG,
      auditEventId: EVT,
      sessions: [
        session({
          id: 's1',
          auditorIds: [AUDITOR_A],
          start: '2026-05-04T09:00:00Z',
          end: '2026-05-04T11:00:00Z',
        }),
        session({
          id: 's2',
          auditorIds: [AUDITOR_B],
          start: '2026-05-04T09:00:00Z',
          end: '2026-05-04T11:00:00Z',
        }),
      ],
    });
    const conflicts = detectPlanConflicts(plan);
    expect(conflicts.filter((c) => c.code === 'AUDITOR_DOUBLE_BOOKED')).toEqual([]);
  });
});

describe('detectPlanConflicts — lunch break', () => {
  it('flags > 6 h day with no 30-min gap', () => {
    const plan = buildPlan({
      engagementId: ENG,
      auditEventId: EVT,
      sessions: [
        session({ id: 's1', start: '2026-05-04T08:00:00Z', end: '2026-05-04T11:50:00Z' }),
        session({ id: 's2', start: '2026-05-04T12:00:00Z', end: '2026-05-04T15:00:00Z' }),
      ],
    });
    const conflicts = detectPlanConflicts(plan);
    expect(conflicts.some((c) => c.code === 'AUDITOR_NO_LUNCH_BREAK')).toBe(true);
  });

  it('does not flag when 30+ minute gap exists', () => {
    const plan = buildPlan({
      engagementId: ENG,
      auditEventId: EVT,
      sessions: [
        session({ id: 's1', start: '2026-05-04T08:00:00Z', end: '2026-05-04T11:30:00Z' }),
        session({ id: 's2', start: '2026-05-04T12:30:00Z', end: '2026-05-04T16:00:00Z' }),
      ],
    });
    const conflicts = detectPlanConflicts(plan);
    expect(conflicts.some((c) => c.code === 'AUDITOR_NO_LUNCH_BREAK')).toBe(false);
  });

  it('does not flag short days', () => {
    const plan = buildPlan({
      engagementId: ENG,
      auditEventId: EVT,
      sessions: [
        session({ id: 's1', start: '2026-05-04T09:00:00Z', end: '2026-05-04T13:00:00Z' }),
      ],
    });
    expect(
      detectPlanConflicts(plan).some((c) => c.code === 'AUDITOR_NO_LUNCH_BREAK'),
    ).toBe(false);
  });
});

describe('detectPlanConflicts — travel time', () => {
  it('flags insufficient travel time between sites', () => {
    const plan = buildPlan({
      engagementId: ENG,
      auditEventId: EVT,
      sessions: [
        session({
          id: 's1',
          start: '2026-05-04T09:00:00Z',
          end: '2026-05-04T10:00:00Z',
          location: 'Site A',
        }),
        session({
          id: 's2',
          start: '2026-05-04T10:10:00Z',
          end: '2026-05-04T11:00:00Z',
          location: 'Site B',
        }),
      ],
    });
    expect(
      detectPlanConflicts(plan).some(
        (c) => c.code === 'INSUFFICIENT_TRAVEL_TIME',
      ),
    ).toBe(true);
  });

  it('does not flag same-location adjacencies', () => {
    const plan = buildPlan({
      engagementId: ENG,
      auditEventId: EVT,
      sessions: [
        session({
          id: 's1',
          start: '2026-05-04T09:00:00Z',
          end: '2026-05-04T10:00:00Z',
          location: 'Room 1',
        }),
        session({
          id: 's2',
          start: '2026-05-04T10:05:00Z',
          end: '2026-05-04T11:00:00Z',
          location: 'Room 1',
        }),
      ],
    });
    expect(
      detectPlanConflicts(plan).some(
        (c) => c.code === 'INSUFFICIENT_TRAVEL_TIME',
      ),
    ).toBe(false);
  });
});

describe('detectPlanConflicts — invalid sessions / window', () => {
  it('flags zero-length or inverted sessions', () => {
    const plan = buildPlan({
      engagementId: ENG,
      auditEventId: EVT,
      sessions: [
        session({
          id: 'bad',
          start: '2026-05-04T11:00:00Z',
          end: '2026-05-04T10:00:00Z',
        }),
      ],
    });
    expect(
      detectPlanConflicts(plan).some((c) => c.code === 'SESSION_TIMES_INVALID'),
    ).toBe(true);
  });

  it('flags sessions outside the audit window', () => {
    const plan = buildPlan({
      engagementId: ENG,
      auditEventId: EVT,
      sessions: [
        session({
          id: 's',
          start: '2026-05-03T09:00:00Z',
          end: '2026-05-03T10:00:00Z',
        }),
      ],
    });
    const cs = detectPlanConflicts(plan, {
      windowStart: '2026-05-04T00:00:00Z',
      windowEnd: '2026-05-08T23:59:00Z',
    });
    expect(cs.some((c) => c.code === 'SESSION_OUTSIDE_AUDIT_WINDOW')).toBe(true);
  });
});

describe('applyPlanMove', () => {
  it('returns ok when the move introduces no new violations', () => {
    const plan = buildPlan({
      engagementId: ENG,
      auditEventId: EVT,
      sessions: [
        session({ id: 's1', start: '2026-05-04T09:00:00Z', end: '2026-05-04T10:00:00Z' }),
        session({ id: 's2', start: '2026-05-04T11:00:00Z', end: '2026-05-04T12:00:00Z' }),
      ],
    });
    const result = applyPlanMove(plan, 's2', '2026-05-04T13:00:00Z', '2026-05-04T14:00:00Z');
    expect(result.ok).toBe(true);
  });

  it('rejects a move that creates an overlap', () => {
    const plan = buildPlan({
      engagementId: ENG,
      auditEventId: EVT,
      sessions: [
        session({ id: 's1', start: '2026-05-04T09:00:00Z', end: '2026-05-04T10:00:00Z' }),
        session({ id: 's2', start: '2026-05-04T11:00:00Z', end: '2026-05-04T12:00:00Z' }),
      ],
    });
    const result = applyPlanMove(plan, 's2', '2026-05-04T09:30:00Z', '2026-05-04T10:30:00Z');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.violations.some((v) => v.code === 'AUDITOR_DOUBLE_BOOKED'),
      ).toBe(true);
    }
  });

  it('returns SESSION_TIMES_INVALID when session id is unknown', () => {
    const plan = buildPlan({
      engagementId: ENG,
      auditEventId: EVT,
      sessions: [],
    });
    const result = applyPlanMove(plan, 'nope', '2026-05-04T09:00:00Z', '2026-05-04T10:00:00Z');
    expect(result.ok).toBe(false);
  });
});
