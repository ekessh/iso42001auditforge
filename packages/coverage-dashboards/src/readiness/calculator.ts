// SPDX-License-Identifier: BUSL-1.1
/**
 * Transparent readiness calculator per v3 §15.14.
 *
 *   overall_readiness = sum(clause_weight * clause_status_score) / sum(clause_weight)
 *
 *   clause_status_score:
 *     evidenced       = 1.0
 *     partial         = 0.5
 *     contradicted    = 0.0
 *     untouched       = 0.0
 *     na              = excluded
 *
 *   clause_weight (default):
 *     mandatory clauses 4..10 = 1.5
 *     Annex A in-scope (per SoA) = 1.0
 *     out-of-scope per SoA = excluded
 *
 * The methodology is round-tripped via JSON so the audit ledger can store the
 * exact configuration used for any computation. Weight changes require an
 * explicit ledger event; this module surfaces the diff and a structured event
 * (see weight-config-events.ts).
 */
import type {
  ClauseFamily,
  ClauseState,
  ClauseStatus,
  PerClauseScore,
  ReadinessResult,
  SoaScope,
  WeightConfig,
} from '../domain/types.js';

/** Convert a status to its numeric score per the methodology. Returns null
 * for `'na'` because N/A is excluded from numerator AND denominator. */
export function statusScore(status: ClauseStatus): number | null {
  switch (status) {
    case 'evidenced':
      return 1.0;
    case 'partial':
      return 0.5;
    case 'contradicted':
      return 0.0;
    case 'untouched':
      return 0.0;
    case 'na':
      return null;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

/** Resolve the weight for a clause, honouring overrides + scope. Returns null
 * if the clause is excluded (out-of-scope or N/A). */
export function resolveWeight(
  clause: ClauseState,
  soa: SoaScope,
  cfg: WeightConfig,
): number | null {
  if (clause.status === 'na') return null;
  if (!isInScope(clause, soa)) return null;

  if (cfg.perClauseOverrides && cfg.perClauseOverrides[clause.clauseId] !== undefined) {
    const w = cfg.perClauseOverrides[clause.clauseId];
    return typeof w === 'number' ? w : null;
  }
  if (cfg.perFamilyOverrides && cfg.perFamilyOverrides[clause.family] !== undefined) {
    const w = cfg.perFamilyOverrides[clause.family];
    return typeof w === 'number' ? w : null;
  }
  return clause.mandatory ? cfg.mandatoryWeight : cfg.annexAWeight;
}

export function isInScope(clause: ClauseState, soa: SoaScope): boolean {
  if (clause.mandatory) return true; // main-body clauses are always in scope
  if (!clause.inScope) return false;
  if (soa.perClause && soa.perClause[clause.clauseId] !== undefined) {
    return soa.perClause[clause.clauseId]!;
  }
  return soa.inScopeClauseIds.includes(clause.clauseId);
}

export function calcReadiness(
  clauseStates: readonly ClauseState[],
  soa: SoaScope,
  weightConfig: WeightConfig,
): ReadinessResult {
  const perClause: PerClauseScore[] = [];
  let weightedSum = 0;
  let weightTotal = 0;

  // Per-family running totals for the perFamily map.
  const familySums = new Map<ClauseFamily, { num: number; den: number }>();

  for (const c of clauseStates) {
    const weight = resolveWeight(c, soa, weightConfig);
    if (weight == null) {
      perClause.push({
        clauseId: c.clauseId,
        family: c.family,
        weight: 0,
        status: c.status,
        score: 0,
        excluded: true,
      });
      continue;
    }
    const score = statusScore(c.status);
    if (score == null) {
      // status === 'na' shouldn't reach here because resolveWeight returns
      // null for na, but keep defensive.
      perClause.push({
        clauseId: c.clauseId,
        family: c.family,
        weight: 0,
        status: c.status,
        score: 0,
        excluded: true,
      });
      continue;
    }
    weightedSum += weight * score;
    weightTotal += weight;
    perClause.push({
      clauseId: c.clauseId,
      family: c.family,
      weight,
      status: c.status,
      score,
      excluded: false,
    });
    let bucket = familySums.get(c.family);
    if (!bucket) {
      bucket = { num: 0, den: 0 };
      familySums.set(c.family, bucket);
    }
    bucket.num += weight * score;
    bucket.den += weight;
  }

  const overall = weightTotal > 0 ? weightedSum / weightTotal : 0;

  const perFamily: Partial<Record<ClauseFamily, number>> = {};
  for (const [family, agg] of familySums) {
    perFamily[family] = agg.den > 0 ? agg.num / agg.den : 0;
  }

  return {
    overall,
    perFamily: perFamily as Record<ClauseFamily, number>,
    perClause,
    methodology: weightConfig,
  };
}
