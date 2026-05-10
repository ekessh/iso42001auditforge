// SPDX-License-Identifier: BUSL-1.1
import type { PopulationUnit, SamplePopulation } from '../domain/population.js';
import type { SamplePlan } from '../domain/plan.js';
import type { SampleUnit } from '../domain/unit.js';
import { SeededRng } from './seeded-rng.js';

/**
 * MonetaryValuePort — caller-supplied projection of a population unit to a
 * non-negative monetary (or evidence-value) magnitude. MUS biases selection
 * toward higher-value units; perfect for evidence packets where the auditor
 * wants larger items more likely picked.
 */
export interface MonetaryValuePort {
  getValues(unitIds: ReadonlyArray<string>): Record<string, number>;
}

export interface MusSampleResult {
  units: SampleUnit[];
  /** Total population value sum (for transparency in the audit ledger). */
  totalValue: number;
  /** Sampling interval used. */
  intervalValue: number;
}

/**
 * MonetaryUnitSampler — value-weighted systematic sampling. Each unit is
 * selected with probability proportional to its value, by walking the
 * cumulative-value axis at fixed intervals starting from a deterministic
 * random offset. This is the standard MUS / Probability-Proportional-to-Size
 * (PPS) selection method used by financial auditors.
 *
 * Determinism: same seed + same population order + same value port = same
 * selection. Auditors MUST pre-sort population.units by id.
 *
 * Edge cases:
 *   - Zero-value population → degenerates to uniform random.
 *   - Single high-value unit may be selected multiple times in MUS theory;
 *     here we deduplicate (auditor selects each unit once and inspects its
 *     entire value).
 */
export class MonetaryUnitSampler {
  constructor(private readonly port: MonetaryValuePort) {}

  sample(
    population: SamplePopulation,
    plan: Pick<SamplePlan, 'planId' | 'size' | 'seed'>,
  ): MusSampleResult {
    const N = population.units.length;
    const n = Math.min(plan.size, N);
    if (n === 0) return { units: [], totalValue: 0, intervalValue: 0 };

    const ids = population.units.map((u) => u.id);
    const valuesMap = this.port.getValues(ids);
    const values = ids.map((id) => Math.max(0, valuesMap[id] ?? 0));
    const total = values.reduce((a, b) => a + b, 0);

    if (total === 0) {
      // Degenerate: no value information — fall back to uniform sample.
      const rng = new SeededRng(plan.seed);
      const indices = Array.from({ length: N }, (_, i) => i);
      for (let i = 0; i < n; i += 1) {
        const j = i + rng.nextInt(N - i);
        const ti = indices[i]!;
        const tj = indices[j]!;
        indices[i] = tj;
        indices[j] = ti;
      }
      const out: SampleUnit[] = [];
      for (let i = 0; i < n; i += 1) {
        const idx = indices[i]!;
        const u = population.units[idx] as PopulationUnit;
        out.push({
          unitId: u.id,
          planId: plan.planId,
          selectionIndex: i,
          weight: 0,
        });
      }
      return { units: out, totalValue: 0, intervalValue: 0 };
    }

    const interval = total / n;
    const rng = new SeededRng(plan.seed);
    // Deterministic random start in [0, interval).
    const start = rng.nextFloat() * interval;

    // Walk cumulative axis.
    const out: SampleUnit[] = [];
    const seen = new Set<string>();
    let cumulative = 0;
    let nextHit = start;
    let pickIndex = 0;
    for (let i = 0; i < N && pickIndex < n; i += 1) {
      cumulative += values[i] ?? 0;
      while (pickIndex < n && cumulative > nextHit) {
        const u = population.units[i] as PopulationUnit;
        if (!seen.has(u.id)) {
          seen.add(u.id);
          out.push({
            unitId: u.id,
            planId: plan.planId,
            selectionIndex: pickIndex,
            weight: values[i] ?? 0,
          });
        }
        pickIndex += 1;
        nextHit = start + pickIndex * interval;
      }
    }

    return { units: out, totalValue: total, intervalValue: interval };
  }
}
