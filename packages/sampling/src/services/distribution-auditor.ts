// SPDX-License-Identifier: BUSL-1.1
import type { SamplePopulation } from '../domain/population.js';
import type { SampleUnit } from '../domain/unit.js';

export interface DistributionAuditReport {
  /** Empirical distribution observed in the sample. */
  observed: Record<string, number>;
  /** Expected distribution (declared or population-derived). */
  expected: Record<string, number>;
  /** Pearson chi-square statistic. */
  chiSquare: number;
  /** Degrees of freedom (k - 1, where k = number of strata observed/expected). */
  degreesOfFreedom: number;
  /** Approximate upper-tail p-value (Wilson-Hilferty approximation). */
  pValue: number;
  /** Whether the sample's distribution is acceptable at the given alpha. */
  pass: boolean;
  alpha: number;
}

/**
 * DistributionAuditor — chi-square goodness-of-fit on observed vs declared.
 *
 * If the population declares `declaredStrataDistribution`, that is used;
 * otherwise the population's empirical distribution is used as expected.
 *
 * Uses Wilson-Hilferty cube-root transform to convert chi-square to a
 * standard normal, avoiding a chi-square CDF table dependency.
 */
export class DistributionAuditor {
  audit(
    population: SamplePopulation,
    sample: ReadonlyArray<SampleUnit>,
    options: { alpha?: number; expected?: Record<string, number> } = {},
  ): DistributionAuditReport {
    const alpha = options.alpha ?? 0.05;

    // Build observed counts.
    const observedCounts: Record<string, number> = {};
    for (const u of sample) {
      const k = u.stratum ?? '__unstratified__';
      observedCounts[k] = (observedCounts[k] ?? 0) + 1;
    }

    // Determine expected distribution.
    let expectedDist: Record<string, number>;
    if (options.expected) {
      expectedDist = options.expected;
    } else if (population.declaredStrataDistribution) {
      expectedDist = population.declaredStrataDistribution;
    } else {
      const popCounts: Record<string, number> = {};
      for (const u of population.units) {
        const k = u.stratum ?? '__unstratified__';
        popCounts[k] = (popCounts[k] ?? 0) + 1;
      }
      const total = population.units.length;
      expectedDist = {};
      if (total > 0) {
        for (const [k, v] of Object.entries(popCounts)) expectedDist[k] = v / total;
      }
    }

    // Union of keys.
    const keys = new Set<string>([
      ...Object.keys(observedCounts),
      ...Object.keys(expectedDist),
    ]);

    const n = sample.length;
    let chiSquare = 0;
    let usedKeys = 0;
    const observed: Record<string, number> = {};
    const expected: Record<string, number> = {};

    for (const k of keys) {
      const obs = observedCounts[k] ?? 0;
      const probability = expectedDist[k] ?? 0;
      const exp = probability * n;
      observed[k] = obs / Math.max(1, n);
      expected[k] = probability;
      // Skip near-zero expected to avoid divide-by-zero blowup.
      if (exp > 1e-9) {
        chiSquare += ((obs - exp) ** 2) / exp;
        usedKeys++;
      } else if (obs > 0) {
        // Observed something we expected zero of: fail open with large penalty.
        chiSquare += obs * obs;
        usedKeys++;
      }
    }

    const dof = Math.max(1, usedKeys - 1);
    const pValue = chiSquareUpperTailP(chiSquare, dof);
    const pass = pValue >= alpha;

    return {
      observed,
      expected,
      chiSquare,
      degreesOfFreedom: dof,
      pValue,
      pass,
      alpha,
    };
  }
}

/**
 * Upper-tail p-value of chi-square via Wilson-Hilferty approximation.
 *
 *   z ≈ ((X²/k)^(1/3) - (1 - 2/(9k))) / sqrt(2/(9k))
 *
 * Then `p = 1 - Φ(z)`. Accurate to ~3 decimals for k >= 2 — sufficient for
 * "pass/fail at α=0.05" auditor reporting.
 */
function chiSquareUpperTailP(x: number, k: number): number {
  if (x <= 0) return 1;
  const a = 2 / (9 * k);
  const z = (Math.cbrt(x / k) - (1 - a)) / Math.sqrt(a);
  return 1 - standardNormalCdf(z);
}

function standardNormalCdf(z: number): number {
  // Abramowitz & Stegun 7.1.26 erf approximation.
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t -
      0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}
