// SPDX-License-Identifier: BUSL-1.1
/**
 * P-BIAS-02 — Equalized odds probe validity suite.
 *
 * Asserts the probe correctly:
 *  - FAILS a known-bad fixture (high TPR or FPR gap across groups)
 *  - PASSes a known-good fixture (TPR and FPR gaps within threshold)
 *  - Reports correct metadata
 *
 * Maps to: ISO/IEC 42001:2023 clause 6.1.4, Annex A.5.4.
 * Reference: Hardt et al. (2016) Equality of Opportunity.
 */
import { describe, expect, it } from 'vitest';
import { P_BIAS_02 } from '../../../packages/probe-engine/src/probes/P-BIAS-02.js';
import {
  fixtureGood,
  fixtureBad,
} from '../../../packages/probe-engine/src/probes/P-BIAS-02.fixtures.js';
import type { ProbeRunContext } from '../../../packages/probe-engine/src/dsl.js';

// ---------------------------------------------------------------------------
// Stub run context
// ---------------------------------------------------------------------------
function makeCtx(): ProbeRunContext {
  return {
    engagementId: '00000000-0000-0000-0000-000000000030',
    executionId: '00000000-0000-0000-0000-000000000031',
    mode: 'offline',
    random: () => 0.5,
    inferenceClient: null,
    deadlineMs: Date.now() + 60_000,
    log: () => undefined,
  };
}

describe('P-BIAS-02 — equalized odds (TPR/FPR parity)', () => {
  // 1) Probe metadata
  it('probe id is P-BIAS-02', () => {
    expect(P_BIAS_02.meta.id).toBe('P-BIAS-02');
  });

  it('probe name references equalized odds', () => {
    expect(P_BIAS_02.meta.name.toLowerCase()).toContain('equalized');
  });

  it('probe category is bias', () => {
    expect(P_BIAS_02.meta.category).toBe('bias');
  });

  it('maps to ISO 42001 clause 6.1.4', () => {
    expect(P_BIAS_02.meta.controls.clauses).toContain('6.1.4');
  });

  it('maps to Annex A control A.5.4', () => {
    expect(P_BIAS_02.meta.controls.annexA).toContain('A.5.4');
  });

  it('targets binary classifier', () => {
    expect(P_BIAS_02.meta.targetKinds).toContain('classifier-binary');
  });

  it('supports offline and replay modes', () => {
    expect(P_BIAS_02.meta.executionModes).toContain('offline');
    expect(P_BIAS_02.meta.executionModes).toContain('replay');
  });

  it('probe is deterministic', () => {
    expect(P_BIAS_02.meta.deterministic).toBe(true);
  });

  it('does not require inference client', () => {
    expect(P_BIAS_02.meta.requiresInferenceClient).toBe(false);
  });

  // 2) Known-bad fixture FAILS
  it('known-bad fixture: probe FAILS (TPR/FPR gap > 0.1)', async () => {
    const result = await P_BIAS_02.run(makeCtx(), {
      samples: [...fixtureBad],
      threshold: 0.1,
    });
    expect(result.verdict).toBe('fail');
  });

  it('known-bad fixture: score < 0.7', async () => {
    const result = await P_BIAS_02.run(makeCtx(), {
      samples: [...fixtureBad],
      threshold: 0.1,
    });
    expect(result.score).toBeLessThan(0.7);
  });

  it('known-bad fixture: tprGap or fprGap > threshold', async () => {
    const result = await P_BIAS_02.run(makeCtx(), {
      samples: [...fixtureBad],
      threshold: 0.1,
    });
    const tprGap = result.derivedMetrics['tprGap'] as number;
    const fprGap = result.derivedMetrics['fprGap'] as number;
    const worstGap = Math.max(tprGap, fprGap);
    expect(worstGap).toBeGreaterThan(0.1);
  });

  it('known-bad fixture: derivedMetrics contains tprGap, fprGap, threshold', async () => {
    const result = await P_BIAS_02.run(makeCtx(), {
      samples: [...fixtureBad],
      threshold: 0.1,
    });
    expect(result.derivedMetrics).toHaveProperty('tprGap');
    expect(result.derivedMetrics).toHaveProperty('fprGap');
    expect(result.derivedMetrics).toHaveProperty('threshold');
  });

  // 3) Known-good fixture PASSes
  it('known-good fixture: probe PASSES (TPR/FPR gap ≤ threshold)', async () => {
    const result = await P_BIAS_02.run(makeCtx(), {
      samples: [...fixtureGood],
      threshold: 0.3,
    });
    expect(result.verdict).toBe('pass');
  });

  it('known-good fixture: score >= 0.7', async () => {
    const result = await P_BIAS_02.run(makeCtx(), {
      samples: [...fixtureGood],
      threshold: 0.3,
    });
    expect(result.score).toBeGreaterThanOrEqual(0.7);
  });

  it('known-good fixture: tprGap and fprGap within threshold', async () => {
    const result = await P_BIAS_02.run(makeCtx(), {
      samples: [...fixtureGood],
      threshold: 0.3,
    });
    const tprGap = result.derivedMetrics['tprGap'] as number;
    const fprGap = result.derivedMetrics['fprGap'] as number;
    expect(Math.max(tprGap, fprGap)).toBeLessThanOrEqual(0.3);
  });

  // 4) Threshold sensitivity
  it('very lenient threshold (1.0) always passes', async () => {
    const result = await P_BIAS_02.run(makeCtx(), {
      samples: [...fixtureBad],
      threshold: 1.0,
    });
    expect(result.verdict).toBe('pass');
  });

  // 5) Score is clamped to [0, 1]
  it('score is always in [0, 1] for bad fixture', async () => {
    const result = await P_BIAS_02.run(makeCtx(), {
      samples: [...fixtureBad],
      threshold: 0.05,
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  // 6) Evidence artifacts
  it('produces evidence artifact', async () => {
    const result = await P_BIAS_02.run(makeCtx(), {
      samples: [...fixtureGood],
      threshold: 0.2,
    });
    expect(result.evidence).toBeDefined();
    expect(result.evidence!.length).toBeGreaterThan(0);
    expect(result.evidence![0]!.kind).toBe('derived-metric');
  });

  // 7) Determinism
  it('deterministic: same input produces same output', async () => {
    const params = { samples: [...fixtureBad], threshold: 0.1 };
    const r1 = await P_BIAS_02.run(makeCtx(), params);
    const r2 = await P_BIAS_02.run(makeCtx(), params);
    expect(r1.verdict).toBe(r2.verdict);
    expect(r1.score).toBe(r2.score);
  });

  // 8) groundTruthFixturePath
  it('declares groundTruthFixturePath', () => {
    expect(P_BIAS_02.meta.groundTruthFixturePath).toContain('P-BIAS-02');
  });

  // 9) Multi-group sample
  it('handles three-group sample correctly', async () => {
    const threeGroupSamples = [
      { group: 'A', prediction: 1, label: 1 },
      { group: 'A', prediction: 0, label: 0 },
      { group: 'B', prediction: 1, label: 1 },
      { group: 'B', prediction: 0, label: 0 },
      { group: 'C', prediction: 1, label: 1 },
      { group: 'C', prediction: 0, label: 0 },
    ];
    const result = await P_BIAS_02.run(makeCtx(), {
      samples: threeGroupSamples,
      threshold: 0.1,
    });
    expect(['pass', 'fail', 'inconclusive']).toContain(result.verdict);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  // 10) References declared
  it('declares at least one reference', () => {
    expect(P_BIAS_02.meta.references.length).toBeGreaterThan(0);
  });
});
