// SPDX-License-Identifier: BUSL-1.1
/**
 * Finding domain types per ISO/IEC 17021-1:2015 clause 9.4.8 and the
 * ISO/IEC 42001 Annex A control set. The `type` discriminator is a
 * tagged-union (no booleans) so the state machine and analytics code
 * can pattern-match exhaustively.
 */
import type {
  AuditEventId,
  AuditorId,
  ClientId,
  EngagementId,
  EvidenceId,
  FindingId,
  FirmId,
} from '@auditforge/shared';

/**
 * Finding type per ISO/IEC 17021-1 9.4.8:
 * - `major_nc` — significant non-fulfilment of a requirement; blocks certification
 * - `minor_nc` — isolated non-fulfilment that does not raise systemic concern
 * - `ofi` — Opportunity For Improvement (not a non-conformity)
 * - `conformity` — explicit, evidenced statement of conformity (positive finding)
 */
export type FindingType = 'major_nc' | 'minor_nc' | 'ofi' | 'conformity';

/**
 * Internal severity (auditor judgement). Distinct from `type` because two
 * minor NCs can differ in severity (e.g. low vs high) without being major.
 */
export type FindingSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * 1..5 risk rating consumed by NC trend analytics and surveillance scoping.
 */
export type FindingRiskRating = 1 | 2 | 3 | 4 | 5;

/**
 * Full lifecycle of a finding. Drives the state machine in
 * `src/state-machine`. No optional / boolean flags — the union is exhaustive
 * and every transition is enumerated.
 */
export type FindingStatus =
  | 'draft'
  | 'issued'
  | 'accepted'
  | 'disputed'
  | 'resolved'
  | 'closed';

/**
 * Reference to a clause in a framework catalogue. We don't pin to a single
 * framework here because a finding can cite ISO 42001 main body clauses and
 * Annex A controls in the same record. (See `controlLinks` for Annex A
 * convenience.)
 */
export interface ClauseLink {
  /**
   * The framework the clause belongs to. Almost always
   * `'ISO_42001'` for AIMS audits, but combined-audit findings may also
   * reference `'ANNEX_A'` directly or `'EU_AI_ACT'` etc.
   */
  readonly framework: string;
  /** Catalogue clause ID (e.g. `"4.1"`, `"6.1.2"`). */
  readonly clauseId: string;
}

/**
 * Reference to an Annex A control. Kept separate from `ClauseLink` so the
 * report writer can easily list NCs grouped by Annex A category vs main-body
 * clause without a runtime filter.
 */
export interface ControlLink {
  /** Annex A control ID (e.g. `"A.5.4"`). */
  readonly controlId: string;
}

/**
 * Reference to a piece of evidence collected during the audit, owned by the
 * (future) evidence service. Findings hold only the IDs; the evidence
 * payloads (files, traces, working papers) live elsewhere.
 */
export interface EvidenceLink {
  readonly evidenceId: EvidenceId;
}

/**
 * Disposition history entry — every state transition appended in order.
 *
 * Auditees can mark "disputed" with a `note`; auditors then write a
 * disposition (accept the dispute → revise; or reject → keep the finding).
 *
 * The state machine writes one of these on every transition; the registry
 * also emits a `LedgerEvent` so the audit ledger has a separate, hash-chained
 * record.
 */
export interface DispositionHistoryEntry {
  readonly at: string; // ISO 8601 timestamp
  readonly by: AuditorId;
  readonly fromStatus: FindingStatus;
  readonly toStatus: FindingStatus;
  readonly action:
    | 'created'
    | 'issue'
    | 'accept'
    | 'dispute'
    | 'resolve'
    | 'close'
    | 'reopen';
  readonly note?: string;
}

/**
 * Optional reference indicating that a finding was carried forward from a
 * prior audit event into the current one (typically S2 → Surv1 for an open
 * NC). The carry-forward engine populates this when materialising the
 * surveillance plan; the original finding stays in place and the new one
 * cross-references it.
 */
export interface SurveillanceCarryForwardLink {
  readonly sourceFindingId: FindingId;
  readonly sourceAuditEventId: AuditEventId;
  readonly carriedAt: string; // ISO 8601 timestamp
}

/**
 * The finding aggregate. All fields are `readonly` — the registry produces
 * a new immutable record on every transition (event-sourced style).
 *
 * Tenancy: `(firmId, clientId, engagementId)` is duplicated from the
 * engagement to short-circuit cross-tenant access without a lookup join.
 */
export interface Finding {
  readonly id: FindingId;
  readonly firmId: FirmId;
  readonly clientId: ClientId;
  readonly engagementId: EngagementId;
  readonly auditEventId: AuditEventId;
  readonly type: FindingType;
  readonly number: string;
  readonly clauseLinks: readonly ClauseLink[];
  readonly controlLinks: readonly ControlLink[];
  readonly evidenceLinks: readonly EvidenceLink[];
  readonly requirementText: string;
  readonly statementText: string;
  readonly rootCausePromptResponse: string;
  readonly raisedBy: AuditorId;
  readonly raisedAt: string; // ISO 8601 timestamp
  readonly status: FindingStatus;
  readonly severity: FindingSeverity;
  readonly riskRating: FindingRiskRating;
  readonly dispositionHistory: readonly DispositionHistoryEntry[];
  readonly carryForwardFrom?: SurveillanceCarryForwardLink;
  /**
   * Free-form topic tags used by trend analytics for root-cause clustering
   * (e.g. "training-data", "consent", "drift", "vendor-due-diligence").
   */
  readonly topicTags: readonly string[];
  /**
   * Last update timestamp (any field write). Used for SLA + trend windows.
   */
  readonly updatedAt: string;
}

/**
 * Input payload for `FindingRegistry.create`. The registry assigns
 * `id`, `number`, `raisedAt`, initial `status='draft'`, empty
 * `dispositionHistory`, and `updatedAt`.
 */
export interface CreateFindingInput {
  readonly firmId: FirmId;
  readonly clientId: ClientId;
  readonly engagementId: EngagementId;
  readonly auditEventId: AuditEventId;
  readonly type: FindingType;
  readonly clauseLinks: readonly ClauseLink[];
  readonly controlLinks: readonly ControlLink[];
  readonly evidenceLinks: readonly EvidenceLink[];
  readonly requirementText: string;
  readonly statementText: string;
  readonly rootCausePromptResponse: string;
  readonly raisedBy: AuditorId;
  readonly severity: FindingSeverity;
  readonly riskRating: FindingRiskRating;
  readonly topicTags?: readonly string[];
  readonly carryForwardFrom?: SurveillanceCarryForwardLink;
}

/**
 * The set of statuses considered "open" for surveillance carry-forward.
 * `disputed` is open because the dispute has not been adjudicated; once
 * accepted or resolved the finding moves out of this set.
 */
export const OPEN_FINDING_STATUSES: readonly FindingStatus[] = [
  'draft',
  'issued',
  'accepted',
  'disputed',
];

export function isOpenFinding(f: Finding): boolean {
  return OPEN_FINDING_STATUSES.includes(f.status);
}
