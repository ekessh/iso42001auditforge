// SPDX-License-Identifier: BUSL-1.1
import type {
  AuditEventId,
  EngagementId,
} from '@auditforge/shared';

import type { AuditPlan, PlanSession } from '../types/plan.js';

interface BuildPlanInputs {
  readonly engagementId: EngagementId;
  readonly auditEventId: AuditEventId;
  readonly sessions: readonly PlanSession[];
  readonly objectives?: readonly string[];
  readonly criteria?: readonly string[];
  readonly samplingNarrative?: string;
  readonly id?: string;
  readonly version?: number;
}

let counter = 0;

/** Cheap deterministic id generator for tests. */
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter.toString(16).padStart(8, '0')}`;
}

/**
 * Build a fresh `AuditPlan` aggregate. The receipt always starts in
 * `sent` state — the auditee acceptance machine is driven by
 * `PlanReceiptStateMachine`.
 *
 * @see ISO/IEC 17021-1:2015 clause 9.4.2 (audit plan content)
 */
export function buildPlan(inputs: BuildPlanInputs): AuditPlan {
  // Stable order: by start time then by id.
  const sessions = [...inputs.sessions].sort((a, b) =>
    a.start === b.start ? a.id.localeCompare(b.id) : a.start.localeCompare(b.start),
  );
  return {
    id: inputs.id ?? nextId('plan'),
    engagementId: inputs.engagementId,
    auditEventId: inputs.auditEventId,
    version: inputs.version ?? 1,
    sessions: Object.freeze(sessions),
    receipt: {
      status: 'sent',
      sentAt: new Date(0).toISOString(),
      comments: Object.freeze([]),
    },
    objectives: Object.freeze([...(inputs.objectives ?? [])]),
    criteria: Object.freeze([...(inputs.criteria ?? [])]),
    ...(inputs.samplingNarrative !== undefined
      ? { samplingNarrative: inputs.samplingNarrative }
      : {}),
  };
}
