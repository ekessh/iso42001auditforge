// SPDX-License-Identifier: BUSL-1.1
import type { PopulationUnit, SamplePopulation } from '../domain/population.js';
import type { SamplePlan } from '../domain/plan.js';
import type { SampleUnit } from '../domain/unit.js';
import { SeededRng } from './seeded-rng.js';

/**
 * StratifiedSampler — proportional allocation over declared strata.
 *
 * Algorithm:
 *   1. Group units by `stratum` (units without a stratum land in `__unstratified__`).
 *   2. Compute proportional allocation: `n_k = round(n * |k| / N)`.
 *   3. Largest-remainder method to make allocations sum to exactly `n`.
 *   4. Within each stratum, sample without replacement via Fisher-Yates seeded
 *      with `seed || ":" || stratum` so that each stratum has its own
 *      reproducible substream.
 */
export class StratifiedSampler {
  sample(
    population: SamplePopulation,
    plan: Pick<SamplePlan, 'planId' | 'size' | 'seed'>,
  ): SampleUnit[] {
    const N = population.units.length;
    const n = Math.min(plan.size, N);
    if (n === 0) return [];

    // Group indices by stratum.
    const buckets = new Map<string, number[]>();
    for (let i = 0; i < N; i++) {
      const u = population.units[i]!;
      const s = u.stratum ?? '__unstratified__';
      let arr = buckets.get(s);
      if (!arr) {
        arr = [];
        buckets.set(s, arr);
      }
      arr.push(i);
    }

    // Stable iteration: sort stratum keys for cross-run reproducibility.
    const keys = Array.from(buckets.keys()).sort();

    // Proportional allocation with largest-remainder rounding.
    const exact = keys.map((k) => (n * (buckets.get(k)!.length / N)));
    const floors = exact.map((x) => Math.floor(x));
    let assigned = floors.reduce((a, b) => a + b, 0);
    const remainders = exact.map((x, i) => ({ i, frac: x - floors[i]! }));
    remainders.sort((a, b) => b.frac - a.frac);
    let r = 0;
    while (assigned < n && r < remainders.length) {
      floors[remainders[r]!.i]!++;
      assigned++;
      r++;
    }
    // Cap allocation at bucket size in case rounding overshoots a small bucket.
    for (let i = 0; i < keys.length; i++) {
      const cap = buckets.get(keys[i]!)!.length;
      if (floors[i]! > cap) {
        const overflow = floors[i]! - cap;
        floors[i] = cap;
        // redistribute overflow to next bucket with capacity (deterministic order)
        for (let j = 0; j < keys.length && overflow > 0; j++) {
          if (j === i) continue;
          const room = buckets.get(keys[j]!)!.length - floors[j]!;
          if (room > 0) {
            const give = Math.min(room, overflow);
            floors[j] = floors[j]! + give;
          }
        }
      }
    }

    const out: SampleUnit[] = [];
    let selectionIndex = 0;
    for (let i = 0; i < keys.length; i++) {
      const stratum = keys[i]!;
      const bucket = buckets.get(stratum)!;
      const take = floors[i]!;
      if (take === 0) continue;

      // Substream RNG per stratum for stability when strata change.
      const rng = new SeededRng(`${plan.seed}::${stratum}`);
      const idx = bucket.slice();
      const m = idx.length;
      const k = Math.min(take, m);
      for (let j = 0; j < k; j++) {
        const swap = j + rng.nextInt(m - j);
        const tj = idx[j]!;
        const ts = idx[swap]!;
        idx[j] = ts;
        idx[swap] = tj;
      }
      for (let j = 0; j < k; j++) {
        const u = population.units[idx[j]!] as PopulationUnit;
        const unit: SampleUnit = {
          unitId: u.id,
          planId: plan.planId,
          selectionIndex: selectionIndex++,
          weight: 1,
        };
        if (stratum !== '__unstratified__') {
          (unit as { stratum?: string }).stratum = stratum;
        } else if (u.stratum !== undefined) {
          (unit as { stratum?: string }).stratum = u.stratum;
        }
        out.push(unit);
      }
    }
    return out;
  }
}
