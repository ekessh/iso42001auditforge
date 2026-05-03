// SPDX-License-Identifier: BUSL-1.1
import type { PopulationUnit, SamplePopulation } from '../src/domain/population.js';

export function makePopulation(
  size: number,
  opts: {
    populationId?: string;
    category?: SamplePopulation['category'];
    strataAssign?: (i: number) => string | undefined;
    riskScoreAssign?: (i: number) => number | undefined;
    declared?: Record<string, number>;
  } = {},
): SamplePopulation {
  const units: PopulationUnit[] = [];
  for (let i = 0; i < size; i++) {
    const u: PopulationUnit = { id: `unit-${i.toString().padStart(5, '0')}` };
    const s = opts.strataAssign?.(i);
    if (s !== undefined) u.stratum = s;
    const r = opts.riskScoreAssign?.(i);
    if (r !== undefined) u.riskScore = r;
    units.push(u);
  }
  const out: SamplePopulation = {
    populationId:
      opts.populationId ?? '00000000-0000-4000-8000-000000000000',
    category: opts.category ?? 'use_cases',
    description: `Synthetic population of size ${size}`,
    units,
  };
  if (opts.declared) out.declaredStrataDistribution = opts.declared;
  return out;
}
