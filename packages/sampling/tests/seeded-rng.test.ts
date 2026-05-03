// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { SeededRng } from '../src/services/seeded-rng.js';

describe('SeededRng', () => {
  it('rejects empty seed', () => {
    expect(() => new SeededRng('')).toThrow(/seed/);
  });

  it('produces identical sequence for identical seeds', () => {
    const a = new SeededRng('engagement-42::pop-x');
    const b = new SeededRng('engagement-42::pop-x');
    for (let i = 0; i < 1000; i++) {
      expect(a.nextU32()).toBe(b.nextU32());
    }
  });

  it('produces different sequences for different seeds', () => {
    const a = new SeededRng('seed-A');
    const b = new SeededRng('seed-B');
    let differ = 0;
    for (let i = 0; i < 100; i++) if (a.nextU32() !== b.nextU32()) differ++;
    expect(differ).toBeGreaterThan(95);
  });

  it('nextFloat is in [0, 1) for many draws', () => {
    const r = new SeededRng('float-test');
    for (let i = 0; i < 10_000; i++) {
      const x = r.nextFloat();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('nextInt(n) returns values in [0, n)', () => {
    const r = new SeededRng('int-test');
    for (let i = 0; i < 5000; i++) {
      const x = r.nextInt(17);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(17);
    }
  });

  it('nextInt rejects non-positive n', () => {
    const r = new SeededRng('bad-n');
    expect(() => r.nextInt(0)).toThrow();
    expect(() => r.nextInt(-1)).toThrow();
    expect(() => r.nextInt(1.5)).toThrow();
  });

  it('uniform-ish distribution: chi-square goodness-of-fit on nextInt(10)', () => {
    const r = new SeededRng('uniformity');
    const counts = new Array<number>(10).fill(0);
    const N = 100_000;
    for (let i = 0; i < N; i++) counts[r.nextInt(10)]!++;
    const expected = N / 10;
    let chi = 0;
    for (const c of counts) chi += ((c - expected) ** 2) / expected;
    // 9 dof, χ²₀.₀₀₁ ≈ 27.88 — uniformity should pass with huge margin
    expect(chi).toBeLessThan(27.88);
  });

  it('property: same seed always replays', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 64 }), (seed) => {
        const a = new SeededRng(seed);
        const b = new SeededRng(seed);
        for (let i = 0; i < 50; i++) {
          if (a.nextU32() !== b.nextU32()) return false;
        }
        return true;
      }),
      { numRuns: 100 },
    );
  });
});
