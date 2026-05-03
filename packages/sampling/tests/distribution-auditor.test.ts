// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { DistributionAuditor } from '../src/services/distribution-auditor.js';
import { RandomSampler } from '../src/services/random-sampler.js';
import { makePopulation } from './helpers.js';

const PLAN_ID = '55555555-5555-4555-8555-555555555555';

describe('DistributionAuditor', () => {
  const auditor = new DistributionAuditor();
  const sampler = new RandomSampler();

  it('passes when sample matches population', () => {
    const pop = makePopulation(1000, {
      strataAssign: (i) => (i < 600 ? 'A' : i < 900 ? 'B' : 'C'),
    });
    const sample = sampler.sample(pop, {
      planId: PLAN_ID,
      size: 200,
      seed: 'match',
    });
    const report = auditor.audit(pop, sample);
    expect(report.pass).toBe(true);
    expect(report.pValue).toBeGreaterThan(0.05);
  });

  it('fails when sample is wildly skewed vs declared distribution', () => {
    const pop = makePopulation(100, {
      strataAssign: (i) => (i < 50 ? 'A' : 'B'),
      declared: { A: 0.5, B: 0.5 },
    });
    // Hand-construct a 100% A sample.
    const sample = pop.units
      .filter((u) => u.stratum === 'A')
      .slice(0, 50)
      .map((u, i) => ({
        unitId: u.id,
        planId: PLAN_ID,
        selectionIndex: i,
        weight: 1,
        stratum: 'A',
      }));
    const report = auditor.audit(pop, sample);
    expect(report.pass).toBe(false);
    expect(report.pValue).toBeLessThan(0.05);
  });

  it('uses declared distribution when present', () => {
    const pop = makePopulation(200, {
      strataAssign: (i) => (i < 100 ? 'A' : 'B'),
      declared: { A: 0.5, B: 0.5 },
    });
    const sample = sampler.sample(pop, {
      planId: PLAN_ID,
      size: 50,
      seed: 'd',
    });
    const report = auditor.audit(pop, sample);
    expect(Object.keys(report.expected).sort()).toEqual(['A', 'B']);
    expect(report.expected['A']).toBe(0.5);
  });

  it('uses caller-supplied expected when provided', () => {
    const pop = makePopulation(100, {
      strataAssign: (i) => (i < 80 ? 'A' : 'B'),
    });
    const sample = sampler.sample(pop, {
      planId: PLAN_ID,
      size: 20,
      seed: 'o',
    });
    const report = auditor.audit(pop, sample, {
      expected: { A: 0.5, B: 0.5 },
    });
    expect(report.expected['A']).toBe(0.5);
  });

  it('handles unstratified population', () => {
    const pop = makePopulation(50);
    const sample = sampler.sample(pop, {
      planId: PLAN_ID,
      size: 10,
      seed: 'u',
    });
    const report = auditor.audit(pop, sample);
    expect(report.observed['__unstratified__']).toBe(1);
  });

  it('handles empty sample without throwing', () => {
    const pop = makePopulation(10, { strataAssign: (i) => (i < 5 ? 'A' : 'B') });
    const report = auditor.audit(pop, []);
    expect(report.chiSquare).toBe(0);
    expect(report.pass).toBe(true);
  });
});
