// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import {
  attributeSampleSize,
  musSampleSize,
  variableSampleSize,
  zScore,
} from '../src/services/formula-calculators.js';

describe('zScore', () => {
  it('returns ~1.96 for 95%', () => {
    expect(zScore(0.95)).toBeCloseTo(1.96, 2);
  });
  it('returns ~2.58 for 99%', () => {
    expect(zScore(0.99)).toBeCloseTo(2.58, 1);
  });
  it('rejects out-of-range confidence', () => {
    expect(() => zScore(0)).toThrowError();
    expect(() => zScore(1)).toThrowError();
  });
});

describe('attributeSampleSize', () => {
  it('produces a positive integer for typical inputs', () => {
    const n = attributeSampleSize({
      N: 1000,
      confidence: 0.95,
      tolerableDeviationRate: 0.05,
      expectedDeviationRate: 0.01,
    });
    expect(n).toBeGreaterThan(0);
    expect(Number.isInteger(n)).toBe(true);
  });

  it('returns 0 when N=0', () => {
    expect(
      attributeSampleSize({
        N: 0,
        confidence: 0.95,
        tolerableDeviationRate: 0.05,
        expectedDeviationRate: 0.01,
      }),
    ).toBe(0);
  });

  it('clamps to N when formula exceeds it', () => {
    const n = attributeSampleSize({
      N: 5,
      confidence: 0.95,
      tolerableDeviationRate: 0.05,
      expectedDeviationRate: 0.01,
    });
    expect(n).toBeLessThanOrEqual(5);
  });

  it('rejects expected >= tolerable', () => {
    expect(() =>
      attributeSampleSize({
        N: 1000,
        confidence: 0.95,
        tolerableDeviationRate: 0.05,
        expectedDeviationRate: 0.05,
      }),
    ).toThrowError();
  });

  it('grows when tolerable - expected gap shrinks', () => {
    const wide = attributeSampleSize({
      N: 100000,
      confidence: 0.95,
      tolerableDeviationRate: 0.1,
      expectedDeviationRate: 0.01,
    });
    const tight = attributeSampleSize({
      N: 100000,
      confidence: 0.95,
      tolerableDeviationRate: 0.03,
      expectedDeviationRate: 0.01,
    });
    expect(tight).toBeGreaterThan(wide);
  });
});

describe('variableSampleSize', () => {
  it('produces a positive integer', () => {
    const n = variableSampleSize({
      N: 5000,
      confidence: 0.95,
      populationStdDev: 100,
      tolerableMisstatement: 50,
      expectedMisstatement: 10,
    });
    expect(n).toBeGreaterThan(0);
  });

  it('rejects non-positive stdDev', () => {
    expect(() =>
      variableSampleSize({
        N: 100,
        confidence: 0.95,
        populationStdDev: 0,
        tolerableMisstatement: 10,
        expectedMisstatement: 1,
      }),
    ).toThrowError();
  });

  it('rejects expected >= tolerable', () => {
    expect(() =>
      variableSampleSize({
        N: 100,
        confidence: 0.95,
        populationStdDev: 50,
        tolerableMisstatement: 10,
        expectedMisstatement: 12,
      }),
    ).toThrowError();
  });
});

describe('musSampleSize', () => {
  it('produces a positive integer', () => {
    const n = musSampleSize({
      populationValue: 1_000_000,
      materiality: 50_000,
      expectedMisstatement: 5_000,
      confidence: 0.95,
    });
    expect(n).toBeGreaterThan(0);
  });

  it('grows when materiality shrinks', () => {
    const a = musSampleSize({
      populationValue: 1_000_000,
      materiality: 100_000,
      expectedMisstatement: 5_000,
      confidence: 0.95,
    });
    const b = musSampleSize({
      populationValue: 1_000_000,
      materiality: 25_000,
      expectedMisstatement: 5_000,
      confidence: 0.95,
    });
    expect(b).toBeGreaterThan(a);
  });

  it('rejects when materiality < expected * expansionFactor', () => {
    expect(() =>
      musSampleSize({
        populationValue: 100,
        materiality: 5,
        expectedMisstatement: 4,
        confidence: 0.95,
      }),
    ).toThrowError();
  });
});
