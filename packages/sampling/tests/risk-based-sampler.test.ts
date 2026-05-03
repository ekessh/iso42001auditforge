// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import {
  RiskBasedSampler,
  StaticRiskScorePort,
} from '../src/services/risk-based-sampler.js';
import { makePopulation } from './helpers.js';

const PLAN_ID = '44444444-4444-4444-8444-444444444444';

describe('RiskBasedSampler', () => {
  it('reproducible with same seed', async () => {
    const pop = makePopulation(200, {
      riskScoreAssign: (i) => (i * 31) % 100,
    });
    const port = new StaticRiskScorePort({});
    const sampler = new RiskBasedSampler(port);
    const a = await sampler.sample(pop, {
      planId: PLAN_ID,
      size: 20,
      seed: 'risk-seed',
    });
    const b = await sampler.sample(pop, {
      planId: PLAN_ID,
      size: 20,
      seed: 'risk-seed',
    });
    expect(a.map((u) => u.unitId)).toEqual(b.map((u) => u.unitId));
  });

  it('high-risk units appear more often than low-risk in repeated trials', async () => {
    const pop = makePopulation(50, {
      // First 5 have risk=99, rest have risk=1.
      riskScoreAssign: (i) => (i < 5 ? 99 : 1),
    });
    const port = new StaticRiskScorePort({});
    const sampler = new RiskBasedSampler(port);
    const highRiskHits = new Map<string, number>();
    const lowRiskHits = new Map<string, number>();
    const trials = 200;
    for (let t = 0; t < trials; t++) {
      const out = await sampler.sample(pop, {
        planId: PLAN_ID,
        size: 5,
        seed: `trial-${t}`,
      });
      for (const u of out) {
        const idx = parseInt(u.unitId.split('-')[1]!, 10);
        if (idx < 5) highRiskHits.set(u.unitId, (highRiskHits.get(u.unitId) ?? 0) + 1);
        else lowRiskHits.set(u.unitId, (lowRiskHits.get(u.unitId) ?? 0) + 1);
      }
    }
    const highMean = Array.from(highRiskHits.values()).reduce((a, b) => a + b, 0) / 5;
    const lowMean = Array.from(lowRiskHits.values()).reduce((a, b) => a + b, 0) / 45;
    expect(highMean).toBeGreaterThan(lowMean * 5);
  });

  it('falls back to unit.riskScore when port is empty', async () => {
    const pop = makePopulation(30, {
      riskScoreAssign: (i) => (i === 0 ? 100 : 0),
    });
    const port = new StaticRiskScorePort({});
    const sampler = new RiskBasedSampler(port);
    let highHits = 0;
    for (let t = 0; t < 50; t++) {
      const s = await sampler.sample(pop, {
        planId: PLAN_ID,
        size: 1,
        seed: `t-${t}`,
      });
      if (s[0]!.unitId === 'unit-00000') highHits++;
    }
    // With weight 101 vs 1 for everyone else, highly likely to dominate.
    expect(highHits).toBeGreaterThan(40);
  });

  it('handles N=0 cleanly', async () => {
    const pop = makePopulation(0);
    const sampler = new RiskBasedSampler(new StaticRiskScorePort({}));
    const s = await sampler.sample(pop, { planId: PLAN_ID, size: 5, seed: 'x' });
    expect(s).toEqual([]);
  });

  it('caps size at N', async () => {
    const pop = makePopulation(3, { riskScoreAssign: () => 50 });
    const sampler = new RiskBasedSampler(new StaticRiskScorePort({}));
    const s = await sampler.sample(pop, {
      planId: PLAN_ID,
      size: 100,
      seed: 'cap',
    });
    expect(s).toHaveLength(3);
  });

  it('records weight on sample units', async () => {
    const pop = makePopulation(10, { riskScoreAssign: (i) => i * 10 });
    const sampler = new RiskBasedSampler(new StaticRiskScorePort({}));
    const s = await sampler.sample(pop, {
      planId: PLAN_ID,
      size: 10,
      seed: 'w',
    });
    for (const u of s) expect(u.weight).toBeGreaterThan(0);
  });
});
