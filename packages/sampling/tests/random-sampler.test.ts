// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { RandomSampler } from '../src/services/random-sampler.js';
import { makePopulation } from './helpers.js';

const PLAN_ID = '11111111-1111-4111-8111-111111111111';

describe('RandomSampler', () => {
  const sampler = new RandomSampler();

  it('returns empty for N=0', () => {
    const pop = makePopulation(0);
    const s = sampler.sample(pop, { planId: PLAN_ID, size: 5, seed: 's' });
    expect(s).toEqual([]);
  });

  it('returns single unit for N=1', () => {
    const pop = makePopulation(1);
    const s = sampler.sample(pop, { planId: PLAN_ID, size: 5, seed: 's' });
    expect(s).toHaveLength(1);
    expect(s[0]!.unitId).toBe('unit-00000');
  });

  it('caps size at N', () => {
    const pop = makePopulation(5);
    const s = sampler.sample(pop, { planId: PLAN_ID, size: 100, seed: 's' });
    expect(s).toHaveLength(5);
  });

  it('reproducible with same seed', () => {
    const pop = makePopulation(500);
    const a = sampler.sample(pop, { planId: PLAN_ID, size: 30, seed: 'rep' });
    const b = sampler.sample(pop, { planId: PLAN_ID, size: 30, seed: 'rep' });
    expect(a.map((u) => u.unitId)).toEqual(b.map((u) => u.unitId));
  });

  it('different seeds produce different selections (most of the time)', () => {
    const pop = makePopulation(1000);
    const a = sampler.sample(pop, { planId: PLAN_ID, size: 30, seed: 'A' });
    const b = sampler.sample(pop, { planId: PLAN_ID, size: 30, seed: 'B' });
    const setA = new Set(a.map((u) => u.unitId));
    let overlap = 0;
    for (const u of b) if (setA.has(u.unitId)) overlap++;
    expect(overlap).toBeLessThan(15);
  });

  it('no duplicates in selection', () => {
    const pop = makePopulation(1000);
    const s = sampler.sample(pop, { planId: PLAN_ID, size: 100, seed: 'dup' });
    const ids = new Set(s.map((u) => u.unitId));
    expect(ids.size).toBe(100);
  });

  it('selectionIndex is sequential 0..n-1', () => {
    const pop = makePopulation(50);
    const s = sampler.sample(pop, { planId: PLAN_ID, size: 10, seed: 'idx' });
    expect(s.map((u) => u.selectionIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('chi-square goodness-of-fit on uniform population', () => {
    // 100 buckets of 100 = 10_000 units; sample 1000; expected ~10 per bucket.
    const pop = makePopulation(10_000, {
      strataAssign: (i) => `bucket-${Math.floor(i / 100)}`,
    });
    const s = sampler.sample(pop, { planId: PLAN_ID, size: 1000, seed: 'chi' });
    const counts = new Map<string, number>();
    for (const u of s) {
      counts.set(u.stratum!, (counts.get(u.stratum!) ?? 0) + 1);
    }
    const expected = 1000 / 100;
    let chi = 0;
    for (let b = 0; b < 100; b++) {
      const c = counts.get(`bucket-${b}`) ?? 0;
      chi += ((c - expected) ** 2) / expected;
    }
    // 99 dof, χ²₀.₀₀₁ ≈ 148.2 — should pass with massive margin.
    expect(chi).toBeLessThan(148.2);
  });

  it('property: every selected unitId exists in population', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 500 }),
        fc.integer({ min: 0, max: 100 }),
        fc.string({ minLength: 1, maxLength: 16 }),
        (N, n, seed) => {
          const pop = makePopulation(N);
          const ids = new Set(pop.units.map((u) => u.id));
          const s = sampler.sample(pop, { planId: PLAN_ID, size: n, seed });
          return s.every((u) => ids.has(u.unitId));
        },
      ),
      { numRuns: 50 },
    );
  });

  it('property: |selection| == min(N, size)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 200 }),
        fc.integer({ min: 0, max: 500 }),
        (N, n) => {
          const pop = makePopulation(N);
          const s = sampler.sample(pop, {
            planId: PLAN_ID,
            size: n,
            seed: 'p',
          });
          return s.length === Math.min(N, n);
        },
      ),
      { numRuns: 50 },
    );
  });
});
