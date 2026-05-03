// SPDX-License-Identifier: BUSL-1.1
import type {
  CoverageState,
  CoverageStatus,
  QuestionLibraryEntry,
  RationaleReason,
} from '../types/domain.js';

export interface PrioritizedEntry {
  readonly entry: QuestionLibraryEntry;
  readonly score: number;
  readonly rationale: readonly RationaleReason[];
}

export interface PrioritizerInput {
  readonly entries: readonly QuestionLibraryEntry[];
  readonly coverage: ReadonlyMap<string, CoverageState>;
  readonly mandatoryClauses: ReadonlySet<string>;
  readonly currentPhaseRequiredClauses: ReadonlySet<string>;
}

const STATUS_WEIGHT: Readonly<Record<CoverageStatus, number>> = {
  untouched: 1,
  partial: 0.6,
  contradicted: 0.9,
  evidenced: 0.05,
  na: 0,
};

/**
 * Boosts questions whose mappedClauses target low-coverage clauses, demotes
 * questions targeting already-evidenced or N/A clauses. Mandatory clauses
 * carry an extra boost. Pure function: stable ordering.
 */
export function prioritize(input: PrioritizerInput): readonly PrioritizedEntry[] {
  const out: PrioritizedEntry[] = [];
  for (const e of input.entries) {
    let score = 0;
    const rationale = new Set<RationaleReason>();
    for (const clauseId of e.mappedClauses) {
      const state = input.coverage.get(clauseId);
      const status: CoverageStatus = state?.status ?? 'untouched';
      const w = STATUS_WEIGHT[status];
      score += w;
      if (w >= 0.6) rationale.add('low-coverage');
      if (status === 'contradicted') rationale.add('contradiction');
      if (input.mandatoryClauses.has(clauseId)) {
        score += 0.5;
        rationale.add('mandatory-clause');
      }
      if (input.currentPhaseRequiredClauses.has(clauseId)) {
        score += 0.25;
        rationale.add('phase-required');
      }
    }
    rationale.add('scenario-match');
    out.push({ entry: e, score, rationale: Array.from(rationale) });
  }
  out.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.entry.id.localeCompare(b.entry.id);
  });
  return out;
}
