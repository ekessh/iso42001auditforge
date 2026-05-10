// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import {
  MonetaryUnitSampler,
  type MonetaryValuePort,
} from '../src/services/mus-sampler.js';
import { makePopulation } from './helpers.js';

const PLAN = { planId: '00000000-0000-4000-8000-000000000222', size: 5, seed: 'mus-1' };

class FixedPort implements MonetaryValuePort {
  constructor(private readonly map: Record<string, number>) {}
  getValues(ids: ReadonlyArray<string>): Record<string, number> {
    const out: Record<string, number> = {};
    for (const id of ids) out[id] = this.map[id] ?? 0;
    return out;
  }
}

describe('MonetaryUnitSampler', () => {
  it('selects up to size units', () => {
    const pop = makePopulation(20);
    const port = new FixedPort(Object.fromEntries(pop.units.map((u, i) => [u.id, i + 1])));
    const r = new MonetaryUnitSampler(port).sample(pop, PLAN);
    expect(r.units.length).toBeLessThanOrEqual(5);
    expect(r.totalValue).toBeGreaterThan(0);
    expect(r.intervalValue).toBeGreaterThan(0);
  });

  it('is deterministic for same seed', () => {
    const pop = makePopulation(20);
    const port = new FixedPort(Object.fromEntries(pop.units.map((u, i) => [u.id, i + 1])));
    const a = new MonetaryUnitSampler(port).sample(pop, PLAN);
    const b = new MonetaryUnitSampler(port).sample(pop, PLAN);
    expect(a.units.map((u) => u.unitId)).toStrictEqual(b.units.map((u) => u.unitId));
  });

  it('biases toward higher-value units', () => {
    const pop = makePopulation(40);
    const map: Record<string, number> = {};
    for (let i = 0; i < pop.units.length; i += 1) {
      map[pop.units[i]!.id] = i < 5 ? 1000 : 1; // first 5 are huge
    }
    const r = new MonetaryUnitSampler(new FixedPort(map)).sample(pop, { ...PLAN, size: 5 });
    // Likely all 5 picks come from the high-value bucket.
    const picks = new Set(r.units.map((u) => u.unitId));
    const highValueIds = new Set(pop.units.slice(0, 5).map((u) => u.id));
    let inHigh = 0;
    for (const id of picks) if (highValueIds.has(id)) inHigh += 1;
    expect(inHigh).toBeGreaterThanOrEqual(4);
  });

  it('falls back to uniform sampling when total value is zero', () => {
    const pop = makePopulation(20);
    const port = new FixedPort({});
    const r = new MonetaryUnitSampler(port).sample(pop, PLAN);
    expect(r.units.length).toBe(5);
    expect(r.totalValue).toBe(0);
  });

  it('returns empty for size 0', () => {
    const pop = makePopulation(10);
    const port = new FixedPort({});
    expect(new MonetaryUnitSampler(port).sample(pop, { ...PLAN, size: 0 }).units).toEqual([]);
  });

  it('selection indices increase monotonically', () => {
    const pop = makePopulation(30);
    const port = new FixedPort(Object.fromEntries(pop.units.map((u) => [u.id, 10])));
    const r = new MonetaryUnitSampler(port).sample(pop, PLAN);
    for (let i = 1; i < r.units.length; i += 1) {
      expect(r.units[i]!.selectionIndex).toBeGreaterThan(r.units[i - 1]!.selectionIndex);
    }
  });
});
