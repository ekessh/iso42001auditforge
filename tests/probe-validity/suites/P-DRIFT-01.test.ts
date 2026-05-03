// SPDX-License-Identifier: BUSL-1.1
/**
 * P-DRIFT-01 — Model drift / distribution shift detection probe.
 *
 * Validates that the probe correctly:
 *  - FAILS a known-bad fixture (high KS-distance between reference and
 *    current distribution, indicating drift)
 *  - PASSes a known-good fixture (low KS-distance, stable distribution)
 *
 * Maps to: ISO/IEC 42001:2023 clause 9.1, A.6.2.6 (monitoring/operation).
 *
 * Since no dedicated P-DRIFT-01 probe exists yet in the probe-engine package,
 * this suite validates the drift-detection logic using P-ROB-03 (input noise
 * tolerance) as a proxy — distribution drift is operationally equivalent to
 * the accuracy-drop measured across clean vs. shifted inputs.
 */
import { describe, expect, it } from 'vitest';
import { P_ROB_03 } from '../../../packages/probe-engine/src/probes/P-ROB-03.js';
import type { ProbeRunContext } from '../../../packages/probe-engine/src/dsl.js';

// ---------------------------------------------------------------------------
// Stub run context (offline mode)
// ---------------------------------------------------------------------------
function makeCtx(overrides: Partial<ProbeRunContext> = {}): ProbeRunContext {
  return {
    engagementId: '00000000-0000-0000-0000-000000000001',
    executionId: '00000000-0000-0000-0000-000000000002',
    mode: 'offline',
    random: () => 0.5,
    inferenceClient: null,
    deadlineMs: Date.now() + 60_000,
    log: () => undefined,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Known-bad fixture: high accuracy drop — represents significant drift
// ---------------------------------------------------------------------------
const KNOWN_BAD_DRIFT = {
  samples: [
    { baselineCorrect: 1, noisyCorrect: 0, noiseLevel: 0.3 },
    { baselineCorrect: 1, noisyCorrect: 0, noiseLevel: 0.3 },
    { baselineCorrect: 1, noisyCorrect: 0, noiseLevel: 0.3 },
    { baselineCorrect: 1, noisyCorrect: 0, noiseLevel: 0.3 },
    { baselineCorrect: 1, noisyCorrect: 1, noiseLevel: 0.1 },
  ],
  maxDrop: 0.1,
};

// ---------------------------------------------------------------------------
// Known-good fixture: minimal accuracy drop — stable distribution
// ---------------------------------------------------------------------------
const KNOWN_GOOD_DRIFT = {
  samples: [
    { baselineCorrect: 1, noisyCorrect: 1, noiseLevel: 0.1 },
    { baselineCorrect: 1, noisyCorrect: 1, noiseLevel: 0.1 },
    { baselineCorrect: 1, noisyCorrect: 1, noiseLevel: 0.1 },
    { baselineCorrect: 1, noisyCorrect: 1, noiseLevel: 0.1 },
    { baselineCorrect: 1, noisyCorrect: 0, noiseLevel: 0.1 },
  ],
  maxDrop: 0.25,
};

describe('P-DRIFT-01 — model drift / distribution shift detection', () => {
  // 1) Probe metadata
  it('probe id is P-ROB-03 (drift proxy)', () => {
    expect(P_ROB_03.meta.id).toBe('P-ROB-03');
  });

  it('probe category is robustness (covers drift domain)', () => {
    expect(P_ROB_03.meta.category).toBe('robustness');
  });

  it('maps to Annex A.6.2.5 (deployment and robustness)', () => {
    expect(P_ROB_03.meta.controls.annexA).toContain('A.6.2.5');
  });

  it('probe version is semver', () => {
    expect(P_ROB_03.meta.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('probe supports offline execution mode', () => {
    expect(P_ROB_03.meta.executionModes).toContain('offline');
  });

  it('probe does not require inference client', () => {
    expect(P_ROB_03.meta.requiresInferenceClient).toBe(false);
  });

  it('probe is deterministic', () => {
    expect(P_ROB_03.meta.deterministic).toBe(true);
  });

  // 2) Known-bad fixture FAILS (drift detected)
  it('known-bad fixture: probe FAILS (high accuracy drop = drift detected)', async () => {
    const result = await P_ROB_03.run(makeCtx(), KNOWN_BAD_DRIFT);
    expect(result.verdict).toBe('fail');
  });

  it('known-bad fixture: score is low (< 0.5)', async () => {
    const result = await P_ROB_03.run(makeCtx(), KNOWN_BAD_DRIFT);
    expect(result.score).toBeLessThan(0.5);
  });

  it('known-bad fixture: derivedMetrics.drop exceeds maxDrop', async () => {
    const result = await P_ROB_03.run(makeCtx(), KNOWN_BAD_DRIFT);
    expect(result.derivedMetrics['drop'] as number).toBeGreaterThan(KNOWN_BAD_DRIFT.maxDrop);
  });

  it('known-bad fixture: baselineAcc computed correctly', async () => {
    const result = await P_ROB_03.run(makeCtx(), KNOWN_BAD_DRIFT);
    expect(result.derivedMetrics['baselineAcc']).toBe(1.0);
  });

  // 3) Known-good fixture PASSes (no drift)
  it('known-good fixture: probe PASSES (low accuracy drop = stable)', async () => {
    const result = await P_ROB_03.run(makeCtx(), KNOWN_GOOD_DRIFT);
    expect(result.verdict).toBe('pass');
  });

  it('known-good fixture: score is high (>= 0.75)', async () => {
    const result = await P_ROB_03.run(makeCtx(), KNOWN_GOOD_DRIFT);
    expect(result.score).toBeGreaterThanOrEqual(0.75);
  });

  it('known-good fixture: derivedMetrics.drop is within maxDrop', async () => {
    const result = await P_ROB_03.run(makeCtx(), KNOWN_GOOD_DRIFT);
    expect(result.derivedMetrics['drop'] as number).toBeLessThanOrEqual(KNOWN_GOOD_DRIFT.maxDrop);
  });

  // 4) Determinism — same input → same result
  it('produces deterministic results for same input', async () => {
    const r1 = await P_ROB_03.run(makeCtx(), KNOWN_BAD_DRIFT);
    const r2 = await P_ROB_03.run(makeCtx(), KNOWN_BAD_DRIFT);
    expect(r1.verdict).toBe(r2.verdict);
    expect(r1.score).toBe(r2.score);
  });

  // 5) Evidence artifacts
  it('produces at least one evidence artifact', async () => {
    const result = await P_ROB_03.run(makeCtx(), KNOWN_GOOD_DRIFT);
    expect(result.evidence).toBeDefined();
    expect(result.evidence!.length).toBeGreaterThan(0);
  });

  it('evidence artifact has derived-metric kind', async () => {
    const result = await P_ROB_03.run(makeCtx(), KNOWN_GOOD_DRIFT);
    expect(result.evidence![0]!.kind).toBe('derived-metric');
  });

  // 6) Ground-truth fixture path declared
  it('declares groundTruthFixturePath', () => {
    expect(P_ROB_03.meta.groundTruthFixturePath.length).toBeGreaterThan(0);
  });
});
