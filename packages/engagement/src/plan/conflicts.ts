// SPDX-License-Identifier: BUSL-1.1
/**
 * Plan conflict detection.
 *
 * Rules:
 *  - An auditor cannot be in two overlapping sessions.
 *  - For any auditor with > 6 hours of sessions in a single day, at least
 *    one ≥ 30-minute gap must exist (lunch break).
 *  - When a session changes location compared to the previous adjacent
 *    session for the same auditor, a configurable travel buffer must
 *    separate them.
 *  - Sessions outside the audit window (configurable) flagged.
 *
 * The detector returns *all* violations rather than failing fast, so the
 * UI can show every problem to the user at once.
 */
import type { AuditorId } from '@auditforge/shared';

import type { AuditPlan, PlanConflict, PlanSession } from '../types/plan.js';

export interface ConflictDetectorOptions {
  /** Required minimum lunch break in minutes once daily on-site time exceeds the trigger. */
  readonly lunchBreakMinutes?: number;
  /** Daily on-site duration (hours) past which a lunch break is required. */
  readonly lunchTriggerHours?: number;
  /** Travel buffer between sessions at different locations (minutes). */
  readonly travelBufferMinutes?: number;
  /** Optional bounds for the audit window — sessions outside flagged. */
  readonly windowStart?: string;
  readonly windowEnd?: string;
}

const DEFAULTS: Required<
  Pick<
    ConflictDetectorOptions,
    'lunchBreakMinutes' | 'lunchTriggerHours' | 'travelBufferMinutes'
  >
> = {
  lunchBreakMinutes: 30,
  lunchTriggerHours: 6,
  travelBufferMinutes: 30,
};

function ts(s: string): number {
  return Date.parse(s);
}

function durationMinutes(s: PlanSession): number {
  return (ts(s.end) - ts(s.start)) / 60000;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function overlaps(a: PlanSession, b: PlanSession): boolean {
  return ts(a.start) < ts(b.end) && ts(b.start) < ts(a.end);
}

/**
 * Run all enabled rules over the plan's sessions and return the union of
 * violations. Pure.
 */
export function detectPlanConflicts(
  plan: AuditPlan,
  options: ConflictDetectorOptions = {},
): readonly PlanConflict[] {
  const opts = { ...DEFAULTS, ...options };
  const conflicts: PlanConflict[] = [];

  // Validate session times are sane.
  for (const s of plan.sessions) {
    if (!(ts(s.start) < ts(s.end))) {
      conflicts.push({
        code: 'SESSION_TIMES_INVALID',
        message: `Session ${s.id} has end <= start`,
        sessionIds: [s.id],
      });
    }
  }

  // Window check.
  if (opts.windowStart !== undefined || opts.windowEnd !== undefined) {
    const ws = opts.windowStart !== undefined ? ts(opts.windowStart) : -Infinity;
    const we = opts.windowEnd !== undefined ? ts(opts.windowEnd) : Infinity;
    for (const s of plan.sessions) {
      if (ts(s.start) < ws || ts(s.end) > we) {
        conflicts.push({
          code: 'SESSION_OUTSIDE_AUDIT_WINDOW',
          message: `Session ${s.id} (${s.start} -> ${s.end}) is outside the audit window`,
          sessionIds: [s.id],
        });
      }
    }
  }

  // Group sessions by auditor.
  const byAuditor = new Map<AuditorId, PlanSession[]>();
  for (const s of plan.sessions) {
    for (const a of s.auditorIds) {
      const list = byAuditor.get(a) ?? [];
      list.push(s);
      byAuditor.set(a, list);
    }
  }

  for (const [auditorId, list] of byAuditor) {
    const sorted = [...list].sort((x, y) => ts(x.start) - ts(y.start));

    // Overlap detection.
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const a = sorted[i];
        const b = sorted[j];
        if (a === undefined || b === undefined) continue;
        if (ts(b.start) >= ts(a.end)) break; // sorted, no further overlap
        if (overlaps(a, b)) {
          conflicts.push({
            code: 'AUDITOR_DOUBLE_BOOKED',
            message: `Auditor ${auditorId} is in overlapping sessions ${a.id} and ${b.id}`,
            sessionIds: [a.id, b.id],
            auditorId,
          });
        }
      }
    }

    // Travel buffer.
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (prev === undefined || cur === undefined) continue;
      if (
        prev.location !== undefined &&
        cur.location !== undefined &&
        prev.location !== cur.location
      ) {
        const gapMin = (ts(cur.start) - ts(prev.end)) / 60000;
        if (gapMin < opts.travelBufferMinutes) {
          conflicts.push({
            code: 'INSUFFICIENT_TRAVEL_TIME',
            message: `Auditor ${auditorId}: only ${Math.max(
              0,
              gapMin,
            )} min between ${prev.location} and ${cur.location}; need ${opts.travelBufferMinutes}`,
            sessionIds: [prev.id, cur.id],
            auditorId,
          });
        }
      }
    }

    // Lunch break per day.
    const byDay = new Map<string, PlanSession[]>();
    for (const s of sorted) {
      const k = dayKey(s.start);
      const list2 = byDay.get(k) ?? [];
      list2.push(s);
      byDay.set(k, list2);
    }
    for (const [, daySessions] of byDay) {
      const totalMin = daySessions.reduce((sum, s) => sum + durationMinutes(s), 0);
      if (totalMin / 60 <= opts.lunchTriggerHours) continue;

      // Find the largest gap between consecutive sessions.
      let maxGap = 0;
      for (let i = 1; i < daySessions.length; i += 1) {
        const prev = daySessions[i - 1];
        const cur = daySessions[i];
        if (prev === undefined || cur === undefined) continue;
        const gap = (ts(cur.start) - ts(prev.end)) / 60000;
        if (gap > maxGap) maxGap = gap;
      }
      if (maxGap < opts.lunchBreakMinutes) {
        conflicts.push({
          code: 'AUDITOR_NO_LUNCH_BREAK',
          message: `Auditor ${auditorId}: ${(totalMin / 60).toFixed(
            1,
          )} h scheduled with max gap ${maxGap.toFixed(0)} min (< ${opts.lunchBreakMinutes})`,
          sessionIds: daySessions.map((s) => s.id),
          auditorId,
        });
      }
    }
  }

  return Object.freeze(conflicts);
}

/** Result of attempting a drag-drop move. */
export type ApplyMoveResult =
  | { ok: true; plan: AuditPlan }
  | { ok: false; violations: readonly PlanConflict[] };

/**
 * Attempt to move a session to a new start/end time. If the resulting
 * plan has *new* conflicts (compared to the original), the move is
 * rejected and the violations returned.
 */
export function applyPlanMove(
  plan: AuditPlan,
  sessionId: string,
  newStart: string,
  newEnd: string,
  options?: ConflictDetectorOptions,
): ApplyMoveResult {
  const target = plan.sessions.find((s) => s.id === sessionId);
  if (target === undefined) {
    return {
      ok: false,
      violations: [
        {
          code: 'SESSION_TIMES_INVALID',
          message: `Session ${sessionId} not found`,
          sessionIds: [sessionId],
        },
      ],
    };
  }

  const before = detectPlanConflicts(plan, options);
  const beforeKeys = new Set(
    before.map((c) => `${c.code}:${[...c.sessionIds].sort().join(',')}`),
  );

  const updated: AuditPlan = {
    ...plan,
    sessions: plan.sessions.map((s) =>
      s.id === sessionId ? { ...s, start: newStart, end: newEnd } : s,
    ),
  };
  const after = detectPlanConflicts(updated, options);

  const newViolations = after.filter(
    (c) => !beforeKeys.has(`${c.code}:${[...c.sessionIds].sort().join(',')}`),
  );

  if (newViolations.length > 0) {
    return { ok: false, violations: Object.freeze(newViolations) };
  }
  return { ok: true, plan: updated };
}
