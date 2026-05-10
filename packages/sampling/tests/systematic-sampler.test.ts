// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { SystematicSampler } from '../src/services/systematic-sampler.js';
import { makePopulation } from './helpers.js';

const PLAN = { planId: '00000000-0000-4000-8000-000000000111', size: 5, seed: 'systematic-1' };

describe('SystematicSampler', () => {
  it('returns the requested number of units', () => {
    const pop = makePopulation(50);
    const out = new SystematicSampler().sample(pop, PLAN);
    expect(out.length).toBe(5);
  });

  it('is deterministic for the same seed', () => {
    const pop = makePopulation(50);
    const a = new SystematicSampler().sample(pop, PLAN);
    const b = new SystematicSampler().sample(pop, PLAN);
    expect(a.map((u) => u.unitId)).toStrictEqual(b.map((u) => u.unitId));
  });

  it('returns empty when n is 0', () => {
    const pop = makePopulation(10);
    const out = new SystematicSampler().sample(pop, { ...PLAN, size: 0 });
    expect(out.length).toBe(0);
  });

  it('handles n >= N by clamping to N', () => {
    const pop = makePopulation(3);
    const out = new SystematicSampler().sample(pop, { ...PLAN, size: 10 });
    expect(out.length).toBe(3);
  });

  it('selection indices are 0..n-1', () => {
    const pop = makePopulation(50);
    const out = new SystematicSampler().sample(pop, PLAN);
    expect(out.map((u) => u.selectionIndex)).toStrictEqual([0, 1, 2, 3, 4]);
  });

  it('produces unique units', () => {
    const pop = makePopulation(100);
    const out = new SystematicSampler().sample(pop, { ...PLAN, size: 20 });
    expect(new Set(out.map((u) => u.unitId)).size).toBe(out.length);
  });
});
