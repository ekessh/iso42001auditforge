// SPDX-License-Identifier: BUSL-1.1
import type {
  AuditEventId,
  AuditorId,
  EngagementId,
  EvidenceId,
  SampleId,
} from '@auditforge/shared';

/**
 * A single segment of the audit timeline. Most plans have one opening, one
 * closing, and many area / interview sessions in between.
 */
export type PlanSessionKind = 'opening' | 'area' | 'interview' | 'closing';

export interface PlanSession {
  readonly id: string;
  /** ISO 8601 instant (e.g. 2026-05-04T09:00:00Z) */
  readonly start: string;
  /** ISO 8601 instant (must be strictly > start) */
  readonly end: string;
  readonly kind: PlanSessionKind;
  /**
   * Free-form area label (e.g. "AIMS Clause 6 — Planning", "Model Lifecycle
   * for Use Case UC-04", "Closing meeting").
   */
  readonly area: string;
  /** Auditors performing the session */
  readonly auditorIds: readonly AuditorId[];
  /** Auditee personnel attending (free-form names; not a system reference) */
  readonly attendees: readonly string[];
  /** Optional sample references (use case IDs, model IDs, agent IDs, etc.) */
  readonly sampleRefs?: readonly SampleId[];
  /** Optional evidence references already collected for this session */
  readonly evidenceRefs?: readonly EvidenceId[];
  /** Optional location label (room, site, "remote/Zoom") */
  readonly location?: string;
}

/**
 * Acceptance state of the auditee's receipt of the plan.
 *
 * sent           -> plan delivered to auditee primary contact
 * received       -> auditee acknowledges receipt (no comments yet)
 * commented      -> auditee proposed edits/objections; auditor must address
 * acknowledged   -> auditee accepts the (possibly revised) plan; locked
 *                   for execution
 *
 * Per ISO/IEC 17021-1:2015 clause 9.4.2, the audit plan must be communicated
 * to and agreed with the auditee before the audit; this state machine
 * captures that handshake.
 */
export type PlanReceiptStatus =
  | 'sent'
  | 'received'
  | 'commented'
  | 'acknowledged';

export interface PlanReceiptComment {
  readonly id: string;
  readonly authorName: string;
  readonly text: string;
  readonly createdAt: string; // ISO 8601 instant
  readonly resolved: boolean;
}

export interface PlanReceipt {
  readonly status: PlanReceiptStatus;
  readonly sentAt?: string;
  readonly receivedAt?: string;
  readonly commentedAt?: string;
  readonly acknowledgedAt?: string;
  readonly comments: readonly PlanReceiptComment[];
}

export interface AuditPlan {
  readonly id: string;
  readonly engagementId: EngagementId;
  readonly auditEventId: AuditEventId;
  readonly version: number;
  readonly sessions: readonly PlanSession[];
  readonly receipt: PlanReceipt;
  readonly samplingNarrative?: string;
  /**
   * Free-form objectives & criteria carried in the plan header; per
   * ISO/IEC 17021-1:2015 clause 9.4.2 the plan must record audit
   * objectives, criteria, and scope.
   */
  readonly objectives: readonly string[];
  readonly criteria: readonly string[];
}

/**
 * Description of a violation surfaced by `detectPlanConflicts` or returned
 * by `applyPlanMove` when the proposed move is not legal.
 */
export interface PlanConflict {
  readonly code:
    | 'AUDITOR_DOUBLE_BOOKED'
    | 'AUDITOR_NO_LUNCH_BREAK'
    | 'INSUFFICIENT_TRAVEL_TIME'
    | 'SESSION_OUTSIDE_AUDIT_WINDOW'
    | 'SESSION_TIMES_INVALID';
  readonly message: string;
  readonly sessionIds: readonly string[];
  readonly auditorId?: AuditorId;
}

/**
 * Adapter contract for rendering a plan as DOCX/PDF. Real rendering lives
 * in `packages/report-engine`; this package only declares the interface.
 */
export interface PlanExportAdapter {
  renderDocx(plan: AuditPlan): Promise<Uint8Array>;
  renderPdf(plan: AuditPlan): Promise<Uint8Array>;
}
