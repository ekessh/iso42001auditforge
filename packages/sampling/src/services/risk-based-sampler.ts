// SPDX-License-Identifier: BUSL-1.1
import type { PopulationUnit, SamplePopulation } from '../domain/population.js';
import type { SamplePlan } from '../domain/plan.js';
import type { SampleUnit } from '../domain/unit.js';
import { SeededRng } from './seeded-rng.js';

/**
 * Port to fetch risk scores from `@auditforge/risks` (or any other source).
 * Implementations MUST return a finite number in [0, 100] for every unit id
 * passed in. Fallback for missing units: caller decides via the port.
 */
export interface RiskScorePort {
  getScores(
    unitIds: ReadonlyArray<string>,
  ): Promise<Record<string, number>> | Record<string, number>;
}

/**
 * RiskBasedSampler — weighted-without-replacement using risk scores.
 *
 * Algorithm: efficient one-pass weighted reservoir (Efraimidis-Spirakis,
 * "A-Res"). For each unit i, compute key `k_i = u_i^(1/w_i)` where
 * `u_i ~ U(0, 1)` (deterministic via SeededRng) and `w_i` is its risk
 * weight. Take the top-n by key. This is unbiased and produces a probability
 * proportional to weight without replacement.
 *
 * Weight transform: `w = max(epsilon, riskScore + 1)`. Adding 1 ensures even
 * zero-risk units have a non-zero chance; epsilon protects against negatives
 * if a port misbehaves.
 */
export class RiskBasedSampler {
  constructor(private readonly riskPort: RiskScorePort) {}

  async sample(
    population: SamplePopulation,
    plan: Pick<SamplePlan, 'planId' | 'size' | 'seed'>,
  ): Promise<SampleUnit[]> {
    const N = population.units.length;
    const n = Math.min(plan.size, N);
    if (n === 0) return [];

    const ids = population.units.map((u) => u.id);
    const portScores = await this.riskPort.getScores(ids);

    const rng = new SeededRng(plan.seed);
    const weighted: Array<{ idx: number; key: number; weight: number }> = [];
    for (let i = 0; i < N; i++) {
      const u = population.units[i]!;
      const score = portScores[u.id] ?? u.riskScore ?? 0;
      const w = Math.max(1e-9, score + 1);
      // Use ln(u)/w to avoid pow underflow, then sort ascending (largest w wins).
      const r = rng.nextFloat();
      const key = -Math.log(r === 0 ? 1e-300 : r) / w;
      weighted.push({ idx: i, key, weight: w });
    }
    weighted.sort((a, b) => a.key - b.key);

    const out: SampleUnit[] = [];
    for (let i = 0; i < n; i++) {
      const w = weighted[i]!;
      const u = population.units[w.idx] as PopulationUnit;
      const unit: SampleUnit = {
        unitId: u.id,
        planId: plan.planId,
        selectionIndex: i,
        weight: w.weight,
      };
      if (u.stratum !== undefined) (unit as { stratum?: string }).stratum = u.stratum;
      out.push(unit);
    }
    return out;
  }
}

/** Convenience port impl for tests / dev. */
export class StaticRiskScorePort implements RiskScorePort {
  constructor(private readonly scores: Record<string, number>) {}
  getScores(ids: ReadonlyArray<string>): Record<string, number> {
    const out: Record<string, number> = {};
    for (const id of ids) out[id] = this.scores[id] ?? 0;
    return out;
  }
}
