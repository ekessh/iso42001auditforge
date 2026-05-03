// SPDX-License-Identifier: BUSL-1.1
/**
 * P-BIAS-01 — Demographic parity probe validity suite.
 *
 * Asserts the probe correctly:
 *  - FAILS a known-bad fixture (high parity gap)
 *  - PASSes a known-good fixture (low parity gap)
 *  - Reports correct metadata (clauses, controls, OWASP LLM ref)
 *
 * Maps to: ISO/IEC 42001:2023 clause 6.1.4, Annex A.5.4.
 * Reference: NIST AI RMF MEASURE-2.11.
 */
import { describe, expect, it } from 'vitest';
import { P_BIAS_01 } from '../../../packages/probe-engine/src/probes/P-BIAS-01.js';
import {
  fixtureGood,
  fixtureBad,
} from '../../../packages/probe-engine/src/probes/P-BIAS-01.fixtures.js';
import type { ProbeRunContext } from '../../../packages/probe-engine/src/dsl.js';

// ---------------------------------------------------------------------------
// Stub run context
// ---------------------------------------------------------------------------
function makeCtx(): ProbeRunContext {
  return {
    engagementId: '00000000-0000-0000-0000-000000000020',
    executionId: '00000000-0000-0000-0000-000000000021',
    mode: 'offline',
    random: () => 0.5,
    inferenceClient: null,
    deadlineMs: Date.now() + 60_000,
    log: () => undefined,
  };
}

// ---------------------------------------------------------------------------
// Compute expected group rates for validation
// ---------------------------------------------------------------------------
function computeGroupRates(samples: readonly { group: string; prediction: 0 | 1 }[]): Record<string, number> {
  const groups = new Map<string, { pos: number; total: number }>();
  for (const s of samples) {
    const g = groups.get(s.group) ?? { pos: 0, total: 0 };
    g.total++;
    if (s.prediction === 1) g.pos++;
    groups.set(s.group, g);
  }
  const rates: Record<string, number> = {};
  for (const [k, v] of groups) {
    rates[k] = v.total === 0 ? 0 : v.pos / v.total;
  }
  return rates;
}

describe('P-BIAS-01 — demographic parity (binary classifier)', () => {
  // 1) Probe metadata checks
  it('probe id is P-BIAS-01', () => {
    expect(P_BIAS_01.meta.id).toBe('P-BIAS-01');
  });

  it('probe name references demographic parity', () => {
    expect(P_BIAS_01.meta.name.toLowerCase()).toContain('parity');
  });

  it('probe category is bias', () => {
    expect(P_BIAS_01.meta.category).toBe('bias');
  });

  it('maps to ISO 42001 clause 6.1.4', () => {
    expect(P_BIAS_01.meta.controls.clauses).toContain('6.1.4');
  });

  it('maps to Annex A control A.5.4', () => {
    expect(P_BIAS_01.meta.controls.annexA).toContain('A.5.4');
  });

  it('references NIST AI RMF MEASURE-2.11', () => {
    const ext = P_BIAS_01.meta.controls.external;
    const nist = ext.find((e) => e.framework === 'NIST_AI_RMF');
    expect(nist).toBeDefined();
    expect(nist!.id).toBe('MEASURE-2.11');
  });

  it('targets binary classifier systems', () => {
    expect(P_BIAS_01.meta.targetKinds).toContain('classifier-binary');
  });

  it('supports offline execution mode', () => {
    expect(P_BIAS_01.meta.executionModes).toContain('offline');
  });

  it('probe is deterministic', () => {
    expect(P_BIAS_01.meta.deterministic).toBe(true);
  });

  it('does not require inference client', () => {
    expect(P_BIAS_01.meta.requiresInferenceClient).toBe(false);
  });

  // 2) Known-bad fixture FAILS (parity gap > threshold)
  it('known-bad fixture: probe FAILS (gap > 0.1)', async () => {
    const result = await P_BIAS_01.run(makeCtx(), {
      samples: [...fixtureBad],
      parityThreshold: 0.1,
    });
    expect(result.verdict).toBe('fail');
  });

  it('known-bad fixture: score reflects high gap (score < 0.7)', async () => {
    const result = await P_BIAS_01.run(makeCtx(), {
      samples: [...fixtureBad],
      parityThreshold: 0.1,
    });
    expect(result.score).toBeLessThan(0.7);
  });

  it('known-bad fixture: parityGap > 0.1', async () => {
    const result = await P_BIAS_01.run(makeCtx(), {
      samples: [...fixtureBad],
      parityThreshold: 0.1,
    });
    expect(result.derivedMetrics['parityGap'] as number).toBeGreaterThan(0.1);
  });

  it('known-bad fixture: groupCount is 2', async () => {
    const result = await P_BIAS_01.run(makeCtx(), {
      samples: [...fixtureBad],
      parityThreshold: 0.1,
    });
    expect(result.derivedMetrics['groupCount']).toBe(2);
  });

  // 3) Known-good fixture PASSes (parity gap <= threshold)
  it('known-good fixture: probe PASSES (gap ≤ 0.1)', async () => {
    const result = await P_BIAS_01.run(makeCtx(), {
      samples: [...fixtureGood],
      parityThreshold: 0.1,
    });
    expect(result.verdict).toBe('pass');
  });

  it('known-good fixture: score is >= 0.8', async () => {
    const result = await P_BIAS_01.run(makeCtx(), {
      samples: [...fixtureGood],
      parityThreshold: 0.1,
    });
    expect(result.score).toBeGreaterThanOrEqual(0.8);
  });

  it('known-good fixture: parityGap ≤ 0.1', async () => {
    const result = await P_BIAS_01.run(makeCtx(), {
      samples: [...fixtureGood],
      parityThreshold: 0.1,
    });
    expect(result.derivedMetrics['parityGap'] as number).toBeLessThanOrEqual(0.1);
  });

  // 4) Group rate computation
  it('computes group rates correctly for known-good fixture', () => {
    const rates = computeGroupRates(fixtureGood);
    expect(rates['A']).toBeDefined();
    expect(rates['B']).toBeDefined();
    // Both groups have equal positive rates in known-good fixture
    expect(Math.abs(rates['A']! - rates['B']!)).toBeLessThanOrEqual(0.1);
  });

  it('computes group rates correctly for known-bad fixture', () => {
    const rates = computeGroupRates(fixtureBad);
    expect(rates['A']).toBeDefined();
    expect(rates['B']).toBeDefined();
    // Bad fixture has large gap
    expect(Math.abs(rates['A']! - rates['B']!)).toBeGreaterThan(0.2);
  });

  // 5) Threshold sensitivity
  it('passes with very lenient threshold (1.0)', async () => {
    const result = await P_BIAS_01.run(makeCtx(), {
      samples: [...fixtureBad],
      parityThreshold: 1.0,
    });
    expect(result.verdict).toBe('pass');
  });

  it('fails with very strict threshold (0.0) even on good fixture', async () => {
    const result = await P_BIAS_01.run(makeCtx(), {
      samples: [
        { group: 'A', prediction: 1, label: 1 },
        { group: 'A', prediction: 0, label: 0 },
        { group: 'B', prediction: 1, label: 1 },
        { group: 'B', prediction: 1, label: 1 }, // slightly different rate
      ],
      parityThreshold: 0.0,
    });
    // Any non-zero gap fails when threshold is 0
    expect(result.verdict).toBe('fail');
  });

  // 6) Evidence artifacts
  it('produces evidence artifact with inline metrics', async () => {
    const result = await P_BIAS_01.run(makeCtx(), {
      samples: [...fixtureGood],
      parityThreshold: 0.1,
    });
    expect(result.evidence).toBeDefined();
    expect(result.evidence!.length).toBeGreaterThan(0);
    expect(result.evidence![0]!.kind).toBe('derived-metric');
  });

  // 7) Determinism
  it('produces same result for same input (deterministic)', async () => {
    const params = { samples: [...fixtureBad], parityThreshold: 0.1 };
    const r1 = await P_BIAS_01.run(makeCtx(), params);
    const r2 = await P_BIAS_01.run(makeCtx(), params);
    expect(r1.verdict).toBe(r2.verdict);
    expect(r1.score).toBe(r2.score);
    expect(r1.derivedMetrics['parityGap']).toBe(r2.derivedMetrics['parityGap']);
  });

  // 8) groundTruthFixturePath declared
  it('declares groundTruthFixturePath', () => {
    expect(P_BIAS_01.meta.groundTruthFixturePath).toContain('P-BIAS-01');
  });
});
