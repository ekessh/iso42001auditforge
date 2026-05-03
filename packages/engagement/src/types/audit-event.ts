// SPDX-License-Identifier: BUSL-1.1
import type { AuditEventId, EngagementId } from '@auditforge/shared';

/**
 * Subtype of a `Special` audit event. Per ISO/IEC 17021-1:2015 clauses 9.6
 * and 9.6.4 + the relevant IAF MDs.
 */
export type SpecialAuditSubtype =
  | 'scope_extension'
  | 'transfer'
  | 'short_notice'
  | 'witnessed';

/**
 * The kind of audit being performed within an engagement. Each engagement
 * can have many `AuditEvent`s — for instance a 3-year cycle has at minimum
 * Stage1, Stage2, Surveillance1, Surveillance2, and Recertification.
 */
export type AuditEventKind =
  | { kind: 'Stage1' }
  | { kind: 'Stage2' }
  | { kind: 'Surveillance'; readonly index: 1 | 2 }
  | { kind: 'Recert' }
  | { kind: 'Special'; readonly subtype: SpecialAuditSubtype };

export type AuditEventStatus =
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

/**
 * Concrete instance of an audit. The engagement owns it; the workflow
 * machines (Stage1Workflow, Stage2Workflow, etc.) drive its state.
 */
export interface AuditEvent {
  readonly id: AuditEventId;
  readonly engagementId: EngagementId;
  readonly type: AuditEventKind;
  readonly plannedStartDate: string; // ISO 8601 date
  readonly plannedEndDate: string; // ISO 8601 date
  readonly status: AuditEventStatus;
  /**
   * The `AuditPlan` ID for this event, if a plan has been produced.
   * Plans are stored separately so they can be revised independently.
   */
  readonly planId?: string;
}

/**
 * Helper: stable string discriminator for an `AuditEventKind`. Useful for
 * map keys, logging, and ledger event payloads.
 */
export function auditEventKindKey(k: AuditEventKind): string {
  switch (k.kind) {
    case 'Stage1':
      return 'Stage1';
    case 'Stage2':
      return 'Stage2';
    case 'Surveillance':
      return `Surveillance#${k.index}`;
    case 'Recert':
      return 'Recert';
    case 'Special':
      return `Special#${k.subtype}`;
  }
}
