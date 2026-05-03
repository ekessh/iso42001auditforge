// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { StratifiedSampler } from '../src/services/stratified-sampler.js';
import { makePopulation } from './helpers.js';

const PLAN_ID = '22222222-2222-4222-8222-222222222222';

describe('StratifiedSampler', () => {
  const sampler = new StratifiedSampler();

  it('proportional allocation: 60/30/10 split', () => {
    const pop = makePopulation(1000, {
      strataAssign: (i) => (i < 600 ? 'A' : i < 900 ? 'B' : 'C'),
    });
    const s = sampler.sample(pop, {
      planId: PLAN_ID,
      size: 100,
      seed: 'strat',
    });
    expect(s).toHaveLength(100);
    const counts = new Map<string, number>();
    for (const u of s) counts.set(u.stratum!, (counts.get(u.stratum!) ?? 0) + 1);
    expect(counts.get('A')).toBe(60);
    expect(counts.get('B')).toBe(30);
    expect(counts.get('C')).toBe(10);
  });

  it('largest-remainder rounding sums to exactly n', () => {
    // Tricky split: 7 strata of varying sizes, sample 50.
    const sizes = [33, 17, 100, 8, 41, 60, 91]; // sum = 350
    const total = sizes.reduce((a, b) => a + b, 0);
    const pop = makePopulation(total, {
      strataAssign: (i) => {
        let acc = 0;
        for (let s = 0; s < sizes.length; s++) {
          acc += sizes[s]!;
          if (i < acc) return `s${s}`;
        }
        return 's0';
      },
    });
    const s = sampler.sample(pop, { planId: PLAN_ID, size: 50, seed: 'lr' });
    expect(s).toHaveLength(50);
  });

  it('reproducible with same seed', () => {
    const pop = makePopulation(500, {
      strataAssign: (i) => (i % 5).toString(),
    });
    const a = sampler.sample(pop, { planId: PLAN_ID, size: 50, seed: 'r' });
    const b = sampler.sample(pop, { planId: PLAN_ID, size: 50, seed: 'r' });
    expect(a.map((u) => u.unitId)).toEqual(b.map((u) => u.unitId));
  });

  it('handles unstratified units', () => {
    const pop = makePopulation(50); // no strata
    const s = sampler.sample(pop, { planId: PLAN_ID, size: 10, seed: 'u' });
    expect(s).toHaveLength(10);
  });

  it('returns empty for empty population', () => {
    const pop = makePopulation(0);
    const s = sampler.sample(pop, { planId: PLAN_ID, size: 10, seed: 'e' });
    expect(s).toEqual([]);
  });

  it('caps allocation at bucket size for tiny strata', () => {
    const pop = makePopulation(20, {
      strataAssign: (i) => (i < 1 ? 'rare' : 'common'),
    });
    // n=15 from N=20: rare=1 unit max, common gets the rest.
    const s = sampler.sample(pop, { planId: PLAN_ID, size: 15, seed: 'cap' });
    expect(s).toHaveLength(15);
    const rareCount = s.filter((u) => u.stratum === 'rare').length;
    expect(rareCount).toBeLessThanOrEqual(1);
  });

  it('property: |selection| == min(n, N)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 200 }),
        fc.integer({ min: 0, max: 200 }),
        (N, n) => {
          const pop = makePopulation(N, {
            strataAssign: (i) => (i % 4).toString(),
          });
          const s = sampler.sample(pop, {
            planId: PLAN_ID,
            size: n,
            seed: 'p',
          });
          return s.length === Math.min(n, N);
        },
      ),
      { numRuns: 50 },
    );
  });
});
