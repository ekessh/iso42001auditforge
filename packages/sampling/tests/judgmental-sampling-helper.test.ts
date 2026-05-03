// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { JudgmentalSamplingHelper } from '../src/services/judgmental-sampling-helper.js';
import { makePopulation } from './helpers.js';

const PLAN_ID = '33333333-3333-4333-8333-333333333333';

describe('JudgmentalSamplingHelper', () => {
  const helper = new JudgmentalSamplingHelper();

  it('captures rationale per pick', () => {
    const pop = makePopulation(20);
    const picks = [
      { unitId: 'unit-00003', rationale: 'Highest revenue model' },
      { unitId: 'unit-00007', rationale: 'Recently retrained' },
      { unitId: 'unit-00012', rationale: 'External vendor' },
    ];
    const out = helper.curate(pop, { planId: PLAN_ID, size: 3 }, picks);
    expect(out).toHaveLength(3);
    expect(out[0]!.rationale).toBe('Highest revenue model');
    expect(out[2]!.unitId).toBe('unit-00012');
  });

  it('rejects size mismatch', () => {
    const pop = makePopulation(10);
    expect(() =>
      helper.curate(pop, { planId: PLAN_ID, size: 3 }, [
        { unitId: 'unit-00001', rationale: 'r' },
      ]),
    ).toThrow(/expected 3 picks/);
  });

  it('rejects empty rationale', () => {
    const pop = makePopulation(10);
    expect(() =>
      helper.curate(pop, { planId: PLAN_ID, size: 1 }, [
        { unitId: 'unit-00001', rationale: '   ' },
      ]),
    ).toThrow(/rationale required/);
  });

  it('rejects duplicates', () => {
    const pop = makePopulation(10);
    expect(() =>
      helper.curate(pop, { planId: PLAN_ID, size: 2 }, [
        { unitId: 'unit-00001', rationale: 'a' },
        { unitId: 'unit-00001', rationale: 'b' },
      ]),
    ).toThrow(/duplicate/);
  });

  it('rejects pick not in population', () => {
    const pop = makePopulation(10);
    expect(() =>
      helper.curate(pop, { planId: PLAN_ID, size: 1 }, [
        { unitId: 'ghost', rationale: 'invented' },
      ]),
    ).toThrow(/not in population/);
  });

  it('preserves stratum from population', () => {
    const pop = makePopulation(5, { strataAssign: (i) => `S${i}` });
    const out = helper.curate(
      pop,
      { planId: PLAN_ID, size: 1 },
      [{ unitId: 'unit-00002', rationale: 'r' }],
    );
    expect(out[0]!.stratum).toBe('S2');
  });
});
