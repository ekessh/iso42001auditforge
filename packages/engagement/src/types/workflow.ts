// SPDX-License-Identifier: BUSL-1.1

/**
 * Canonical state union for the Stage 1 workflow.
 *
 * docReview         — auditor reviewing auditee documentation (manuals, SoA, etc.)
 * scopeVerification — confirming declared scope matches AIMS reality
 * readinessAssess   — gap-analysis of readiness for Stage 2
 * stage2Decision    — go/no-go decision for Stage 2 (per ISO/IEC 17021-1 9.3.1.2)
 * complete          — Stage 1 done, output (decision + readiness report) issued
 * abandoned         — Stage 1 stopped before completion (e.g. auditee withdrawal)
 */
export type Stage1State =
  | 'docReview'
  | 'scopeVerification'
  | 'readinessAssess'
  | 'stage2Decision'
  | 'complete'
  | 'abandoned';

/**
 * Canonical state union for the Stage 2 workflow. Mirrors the on-site /
 * remote audit timeline: opening meeting -> per-area sessions -> interim
 * checkpoint -> closing meeting -> draft report.
 */
export type Stage2State =
  | 'opening'
  | 'areaSessions'
  | 'interimReview'
  | 'closing'
  | 'reportDraft'
  | 'complete'
  | 'abandoned';

export type SurveillanceState =
  | 'ncFollowUp'
  | 'reducedScopeAudit'
  | 'schemeComplianceCheck'
  | 'reportDraft'
  | 'complete'
  | 'abandoned';

export type RecertificationState =
  | 'performanceTrendReview'
  | 'fullReAudit'
  | 'reportDraft'
  | 'decision'
  | 'complete'
  | 'abandoned';

/** Special audit subtypes share a generic state envelope. */
export type SpecialAuditState =
  | 'scoped'
  | 'inProgress'
  | 'reportDraft'
  | 'complete'
  | 'abandoned';

/** Generic discriminated transition record used by every workflow. */
export interface WorkflowTransition<S extends string> {
  readonly from: S;
  readonly to: S;
  readonly at: string; // ISO 8601 instant
  readonly actor?: string; // auditor id or system actor label
  readonly note?: string;
}
