// SPDX-License-Identifier: BUSL-1.1
import type { PopulationUnit, SamplePopulation } from '../domain/population.js';
import type { SamplePlan } from '../domain/plan.js';
import type { SampleUnit } from '../domain/unit.js';
import { SeededRng } from './seeded-rng.js';

/**
 * SystematicSampler — every-k-th selection from a deterministic random start.
 *
 * Useful for ordered populations (chronologically sequenced incidents,
 * working papers, etc.). Reproducibility is guaranteed: the seed determines
 * the random start, the input ordering of `population.units` determines the
 * sequence. Callers MUST pre-sort by `unit.id` (or equivalent stable key)
 * for cross-platform stability.
 */
export class SystematicSampler {
  sample(
    population: SamplePopulation,
    plan: Pick<SamplePlan, 'planId' | 'size' | 'seed'>,
  ): SampleUnit[] {
    const N = population.units.length;
    const n = Math.min(plan.size, N);
    if (n === 0) return [];

    const k = Math.floor(N / n);
    const interval = Math.max(1, k);
    const rng = new SeededRng(plan.seed);
    // Random start in [0, interval) so the chosen positions are not always
    // the first n units. When N % n != 0 we still cover the full population
    // by wrapping mod N.
    const start = rng.nextInt(interval);

    const out: SampleUnit[] = [];
    for (let i = 0; i < n; i += 1) {
      const idx = (start + i * interval) % N;
      const u = population.units[idx] as PopulationUnit;
      const unit: SampleUnit = {
        unitId: u.id,
        planId: plan.planId,
        selectionIndex: i,
        weight: 1,
      };
      if (u.stratum !== undefined) (unit as { stratum?: string }).stratum = u.stratum;
      out.push(unit);
    }
    return out;
  }
}
