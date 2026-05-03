// SPDX-License-Identifier: BUSL-1.1
import type { PopulationUnit, SamplePopulation } from '../domain/population.js';
import type { SamplePlan } from '../domain/plan.js';
import type { SampleUnit } from '../domain/unit.js';
import { SeededRng } from './seeded-rng.js';

/**
 * RandomSampler — uniform sampling without replacement.
 *
 * Uses partial Fisher-Yates over indices to produce a deterministic,
 * reproducible selection from a SeededRng. Order of `population.units` matters
 * for reproducibility — callers MUST sort by `unit.id` before passing if
 * they need cross-platform stability.
 */
export class RandomSampler {
  sample(
    population: SamplePopulation,
    plan: Pick<SamplePlan, 'planId' | 'size' | 'seed'>,
  ): SampleUnit[] {
    const N = population.units.length;
    const n = Math.min(plan.size, N);
    if (n === 0) return [];

    const rng = new SeededRng(plan.seed);
    const indices = new Array<number>(N);
    for (let i = 0; i < N; i++) indices[i] = i;

    // Partial Fisher-Yates — only the first n positions are stabilized.
    for (let i = 0; i < n; i++) {
      const j = i + rng.nextInt(N - i);
      const ti = indices[i]!;
      const tj = indices[j]!;
      indices[i] = tj;
      indices[j] = ti;
    }

    const out: SampleUnit[] = [];
    for (let i = 0; i < n; i++) {
      const idx = indices[i]!;
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
