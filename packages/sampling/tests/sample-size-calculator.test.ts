// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  SampleSizeCalculator,
  SchemeRegistry,
  BUILTIN_RULE_COUNT,
} from '../src/services/index.js';

describe('SampleSizeCalculator', () => {
  const calc = new SampleSizeCalculator();

  it('default rule: n = ceil(sqrt(N)) — golden cases', () => {
    const golden: Array<[number, number]> = [
      [0, 0],
      [1, 1],
      [4, 2],
      [9, 3],
      [10, 4],
      [16, 4],
      [100, 10],
      [101, 11],
      [10_000, 100],
    ];
    for (const [N, expected] of golden) {
      const out = calc.calculate({ N });
      expect(out.size).toBe(expected);
      expect(out.ruleId).toBe('default-sqrt');
    }
  });

  it('rejects negative or non-integer N', () => {
    expect(() => calc.calculate({ N: -1 })).toThrow();
    expect(() => calc.calculate({ N: 3.5 })).toThrow();
  });

  it('low/medium/high complexity rules differ monotonically for N=100', () => {
    const low = calc.calculate({ N: 100, ruleId: 'iso17021-low-complexity' }).size;
    const med = calc.calculate({ N: 100, ruleId: 'iso17021-medium-complexity' }).size;
    const high = calc.calculate({ N: 100, ruleId: 'iso17021-high-complexity' }).size;
    expect(low).toBeLessThanOrEqual(med);
    expect(med).toBeLessThanOrEqual(high);
  });

  it('IAF MD 23 rules enforce floor minimums', () => {
    expect(calc.calculate({ N: 4, ruleId: 'mdr-iaf-md23-aims-low' }).size).toBe(5);
    expect(calc.calculate({ N: 4, ruleId: 'mdr-iaf-md23-aims-high' }).size).toBe(8);
  });

  it('incident-population rule over-samples but never exceeds N', () => {
    expect(calc.calculate({ N: 3, ruleId: 'incident-population' }).size).toBe(3);
    expect(calc.calculate({ N: 100, ruleId: 'incident-population' }).size).toBe(15);
  });

  it('risk overlay multiplier scales by avgRiskScore', () => {
    const noRisk = calc.calculate({ N: 100, applyRiskOverlay: true, avgRiskScore: 0 });
    const fullRisk = calc.calculate({ N: 100, applyRiskOverlay: true, avgRiskScore: 100 });
    expect(noRisk.overlayMultiplier).toBe(1);
    expect(fullRisk.overlayMultiplier).toBe(1.5);
    expect(fullRisk.size).toBeGreaterThan(noRisk.size);
  });

  it('risk overlay rejects out-of-range scores', () => {
    expect(() =>
      calc.calculate({ N: 10, applyRiskOverlay: true, avgRiskScore: 200 }),
    ).toThrow();
    expect(() =>
      calc.calculate({ N: 10, applyRiskOverlay: true, avgRiskScore: -1 }),
    ).toThrow();
  });

  it('bounds clamp size and report `clamped`', () => {
    const out = calc.calculate({
      N: 10_000,
      bounds: { min: 5, max: 30 },
    });
    expect(out.size).toBe(30);
    expect(out.clamped).toBe(true);
  });

  it('bounds.min only applied when N >= bounds.min', () => {
    const tiny = calc.calculate({ N: 2, bounds: { min: 5, max: 30 } });
    expect(tiny.size).toBe(2); // cannot inflate above N
  });

  it('rejects invalid bounds', () => {
    expect(() =>
      calc.calculate({ N: 10, bounds: { min: 10, max: 5 } }),
    ).toThrow();
    expect(() =>
      calc.calculate({ N: 10, bounds: { min: -1, max: 5 } }),
    ).toThrow();
  });

  it('size is always <= N', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 50_000 }), (N) => {
        const out = calc.calculate({ N });
        return out.size >= 0 && out.size <= N;
      }),
      { numRuns: 200 },
    );
  });

  it('property: monotone in N for default-sqrt', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5_000 }),
        fc.integer({ min: 0, max: 5_000 }),
        (a, b) => {
          const A = Math.min(a, b);
          const B = Math.max(a, b);
          const sa = calc.calculate({ N: A }).size;
          const sb = calc.calculate({ N: B }).size;
          return sa <= sb;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('SchemeRegistry ships at least 8 builtin rules', () => {
    expect(BUILTIN_RULE_COUNT).toBeGreaterThanOrEqual(8);
    const reg = SchemeRegistry.defaultRegistry();
    expect(reg.list().length).toBeGreaterThanOrEqual(8);
  });

  it('SchemeRegistry rejects duplicate rule ids', () => {
    const reg = SchemeRegistry.defaultRegistry();
    expect(() =>
      reg.register({ id: 'default-sqrt', description: 'dup', size: () => 1 }),
    ).toThrow();
  });

  it('SchemeRegistry registers custom rules', () => {
    const reg = SchemeRegistry.defaultRegistry();
    reg.register({
      id: 'custom-tenant-x',
      description: 'flat 7',
      size: () => 7,
    });
    const out = new SampleSizeCalculator(reg).calculate({
      N: 1000,
      ruleId: 'custom-tenant-x',
    });
    expect(out.size).toBe(7);
  });
});
