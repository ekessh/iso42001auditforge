// SPDX-License-Identifier: BUSL-1.1
//
// Shared coverage / readiness calculation. Single source of truth used by
// BOTH this package's CoverageTracker and apps/api/src/modules/coverage so
// the dashboard score never diverges from the engine's view.
//
// CLAUDE.md formula:
//
//   overall_readiness =
//       sum(clause_weight * clause_status_score) / sum(clause_weight)
//
//   clause_status_score:
//       evidenced     => 1.0
//       partial       => 0.5
//       contradicted  => 0.0
//       untouched     => 0.0
//       na            => excluded entirely
//
//   clause_weight (default):
//       mandatory clauses 4-10  => 1.5
//       Annex A in-scope        => 1.0
//       out-of-scope            => excluded
//
// Methodology lives in the audit ledger; weight overrides require an
// explicit auditor/admin action and are logged separately.

import type { CoverageStatus } from '../types/domain.js';

export const DEFAULT_MANDATORY_CLAUSES: readonly string[] = [
  '4.1', '4.2', '4.3', '4.4',
  '5.1', '5.2', '5.3',
  '6.1.1', '6.1.2', '6.1.3', '6.1.4', '6.2',
  '7.1', '7.2', '7.3', '7.4', '7.5',
  '8.1', '8.2', '8.3', '8.4',
  '9.1', '9.2', '9.3',
  '10.1', '10.2',
];

export const DEFAULT_MANDATORY_WEIGHT = 1.5;
export const DEFAULT_ANNEX_WEIGHT = 1.0;

export const STATUS_SCORE: Readonly<Record<CoverageStatus, number | null>> = {
  evidenced: 1.0,
  partial: 0.5,
  contradicted: 0.0,
  untouched: 0.0,
  na: null,
};

export interface ClauseAssessment {
  clauseId: string;
  status: CoverageStatus;
  /** marks the clause as in-scope; out-of-scope clauses are excluded entirely */
  inScope: boolean;
  /** explicit weight override (if absent, derived from mandatory list / Annex A) */
  weight?: number;
}

export interface CoverageScoreResult {
  overall: number;
  weightedSum: number;
  weightTotal: number;
  considered: number;
  excluded: number;
  byStatus: Readonly<Record<CoverageStatus, number>>;
}

export interface ScoreOpts {
  mandatoryClauses?: readonly string[];
  mandatoryWeight?: number;
  annexWeight?: number;
}

const ZERO_BUCKET: Record<CoverageStatus, number> = {
  evidenced: 0,
  partial: 0,
  contradicted: 0,
  untouched: 0,
  na: 0,
};

export function isMandatoryClause(
  clauseId: string,
  mandatory: readonly string[] = DEFAULT_MANDATORY_CLAUSES,
): boolean {
  return mandatory.includes(clauseId);
}

export function defaultWeightFor(
  clauseId: string,
  inScope: boolean,
  opts: ScoreOpts = {},
): number {
  if (!inScope) return 0;
  const mandatory = opts.mandatoryClauses ?? DEFAULT_MANDATORY_CLAUSES;
  const mandatoryW = opts.mandatoryWeight ?? DEFAULT_MANDATORY_WEIGHT;
  const annexW = opts.annexWeight ?? DEFAULT_ANNEX_WEIGHT;
  return isMandatoryClause(clauseId, mandatory) ? mandatoryW : annexW;
}

// WHY: explicit calc receives a flat list rather than the live tracker so
// the API layer can call it with rows fetched from coverage_state without
// recreating the tracker.
export function calculateCoverageScore(
  assessments: readonly ClauseAssessment[],
  opts: ScoreOpts = {},
): CoverageScoreResult {
  const byStatus = { ...ZERO_BUCKET };
  let weightedSum = 0;
  let weightTotal = 0;
  let considered = 0;
  let excluded = 0;
  for (const a of assessments) {
    byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
    if (!a.inScope) {
      excluded += 1;
      continue;
    }
    if (a.status === 'na') {
      excluded += 1;
      continue;
    }
    const score = STATUS_SCORE[a.status];
    if (score === null) {
      excluded += 1;
      continue;
    }
    const weight = a.weight ?? defaultWeightFor(a.clauseId, a.inScope, opts);
    if (weight <= 0) {
      excluded += 1;
      continue;
    }
    weightedSum += weight * score;
    weightTotal += weight;
    considered += 1;
  }
  const overall = weightTotal > 0 ? weightedSum / weightTotal : 0;
  return { overall, weightedSum, weightTotal, considered, excluded, byStatus };
}
