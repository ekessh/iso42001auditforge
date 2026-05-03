// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';

import { runExtractionBench } from '../runners/extraction-bench.js';
import { runAttributionBench } from '../runners/attribution-bench.js';
import { runContradictionBench } from '../runners/contradiction-bench.js';
import { runReleaseGate, compareAgainstBaseline, loadBaseline } from '../runners/release-gate.js';

describe('benches', () => {
  it('extraction bench runs and produces deterministic >0 numbers with the floor adapter', async () => {
    const m = await runExtractionBench();
    expect(m.tp).toBeGreaterThan(0);
    expect(m.fp).toBeGreaterThan(0);
    expect(m.precision).toBeGreaterThan(0);
    expect(m.precision).toBeLessThan(1);
    expect(m.f1).toBeGreaterThan(0);
  });

  it('attribution bench reports per-family metrics for at least 5 families', async () => {
    const m = await runAttributionBench();
    expect(m.precisionAt3).toBeGreaterThan(0);
    expect(m.recallAt5).toBeGreaterThan(0);
    expect(Object.keys(m.perFamily).length).toBeGreaterThanOrEqual(5);
  });

  it('contradiction bench finds at least one positive pair', async () => {
    const m = await runContradictionBench();
    expect(m.positivesEvaluated).toBeGreaterThan(0);
    expect(m.tp).toBeGreaterThanOrEqual(0);
    expect(m.tp + m.fn).toBe(m.positivesEvaluated);
  });

  it('release gate passes against the pinned baseline (deterministic adapter)', async () => {
    const r = await runReleaseGate();
    expect(r.status).toBe('pass');
    expect(r.regressions).toEqual([]);
  });

  it('release gate detects a synthetic >5% regression', async () => {
    // Construct a fake baseline where every metric is 1.0 — current results
    // (the deterministic adapter floor) must regress vs that.
    const fake = {
      version: '0',
      extraction: { precision: 1, recall: 1, f1: 1 },
      attribution: {
        precisionAt1: 1, precisionAt3: 1, precisionAt5: 1,
        recallAt1: 1, recallAt3: 1, recallAt5: 1,
      },
      contradiction: { precision: 1, recall: 1, f1: 1 },
    };
    const [extraction, attribution, contradiction] = await Promise.all([
      runExtractionBench(),
      runAttributionBench(),
      runContradictionBench(),
    ]);
    const regs = compareAgainstBaseline(fake, extraction, attribution, contradiction);
    expect(regs.length).toBeGreaterThan(0);
  });

  it('baseline.json round-trips through loadBaseline()', () => {
    const b = loadBaseline();
    expect(typeof b.extraction.precision).toBe('number');
    expect(typeof b.attribution.precisionAt3).toBe('number');
    expect(typeof b.contradiction.recall).toBe('number');
  });
});
