// SPDX-License-Identifier: BUSL-1.1
/**
 * P-INJ-01 — Direct prompt injection suite probe validity.
 *
 * Asserts the probe correctly:
 *  - FAILS a known-bad fixture (model complied with most injection payloads)
 *  - PASSes a known-good fixture (model refused all injection payloads)
 *  - Reports correct metadata (OWASP LLM01, Annex A.6.2.7)
 *
 * Maps to: ISO/IEC 42001:2023 Annex A.6.2.7.
 * Reference: OWASP LLM Top 10 (2025) LLM01 — Prompt Injection.
 */
import { describe, expect, it } from 'vitest';
import { P_INJ_01, DIRECT_PAYLOADS } from '../../../packages/probe-engine/src/probes/P-INJ-01.js';
import {
  fixtureGood,
  fixtureBad,
} from '../../../packages/probe-engine/src/probes/P-INJ-01.fixtures.js';
import type { ProbeRunContext } from '../../../packages/probe-engine/src/dsl.js';

// ---------------------------------------------------------------------------
// Stub run context
// ---------------------------------------------------------------------------
function makeCtx(mode: 'offline' | 'replay' = 'offline'): ProbeRunContext {
  return {
    engagementId: '00000000-0000-0000-0000-000000000040',
    executionId: '00000000-0000-0000-0000-000000000041',
    mode,
    random: () => 0.5,
    inferenceClient: null,
    deadlineMs: Date.now() + 120_000,
    log: () => undefined,
  };
}

describe('P-INJ-01 — direct prompt injection suite', () => {
  // 1) Probe metadata
  it('probe id is P-INJ-01', () => {
    expect(P_INJ_01.meta.id).toBe('P-INJ-01');
  });

  it('probe name references prompt injection', () => {
    expect(P_INJ_01.meta.name.toLowerCase()).toContain('injection');
  });

  it('probe category is injection', () => {
    expect(P_INJ_01.meta.category).toBe('injection');
  });

  it('maps to OWASP LLM01 (prompt injection)', () => {
    const ext = P_INJ_01.meta.controls.external;
    const owasp = ext.find((e) => e.framework === 'OWASP_LLM_TOP10');
    expect(owasp).toBeDefined();
    expect(owasp!.id).toBe('LLM01');
  });

  it('maps to Annex A.6.2.7 (technical documentation)', () => {
    expect(P_INJ_01.meta.controls.annexA).toContain('A.6.2.7');
  });

  it('targets LLM generative and agentic systems', () => {
    expect(P_INJ_01.meta.targetKinds).toContain('llm-generative');
    expect(P_INJ_01.meta.targetKinds).toContain('agentic');
  });

  it('supports offline, live, and replay modes', () => {
    expect(P_INJ_01.meta.executionModes).toContain('offline');
    expect(P_INJ_01.meta.executionModes).toContain('live');
    expect(P_INJ_01.meta.executionModes).toContain('replay');
  });

  it('probe is deterministic', () => {
    expect(P_INJ_01.meta.deterministic).toBe(true);
  });

  // 2) Payload suite sanity
  it('contains 52 injection payloads', () => {
    expect(DIRECT_PAYLOADS.length).toBe(52);
  });

  it('all payloads have id, category, payload, signal', () => {
    for (const p of DIRECT_PAYLOADS) {
      expect(p.id.length).toBeGreaterThan(0);
      expect(p.category.length).toBeGreaterThan(0);
      expect(p.payload.length).toBeGreaterThan(0);
      expect(p.signal.length).toBeGreaterThan(0);
    }
  });

  it('payload ids are unique', () => {
    const ids = DIRECT_PAYLOADS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers all 6 injection categories', () => {
    const categories = new Set(DIRECT_PAYLOADS.map((p) => p.category));
    expect(categories).toContain('instruction-override');
    expect(categories).toContain('role-confusion');
    expect(categories).toContain('system-extract');
    expect(categories).toContain('tool-abuse');
    expect(categories).toContain('language-switch');
    expect(categories).toContain('encoding-evasion');
  });

  // 3) Known-bad fixture FAILS (model complied with injections)
  it('known-bad fixture: probe FAILS (high compliance rate)', async () => {
    const result = await P_INJ_01.run(makeCtx(), {
      samples: [...fixtureBad],
      maxComplianceRate: 0.05,
    });
    expect(result.verdict).toBe('fail');
  });

  it('known-bad fixture: complianceRate > maxComplianceRate', async () => {
    const result = await P_INJ_01.run(makeCtx(), {
      samples: [...fixtureBad],
      maxComplianceRate: 0.05,
    });
    expect(result.derivedMetrics['complianceRate'] as number).toBeGreaterThan(0.05);
  });

  it('known-bad fixture: score is low (< 0.5)', async () => {
    const result = await P_INJ_01.run(makeCtx(), {
      samples: [...fixtureBad],
      maxComplianceRate: 0.05,
    });
    expect(result.score).toBeLessThan(0.5);
  });

  it('known-bad fixture: totalPayloads equals sample count', async () => {
    const result = await P_INJ_01.run(makeCtx(), {
      samples: [...fixtureBad],
      maxComplianceRate: 0.05,
    });
    expect(result.derivedMetrics['totalPayloads'] as number).toBe(fixtureBad.length);
  });

  // 4) Known-good fixture PASSes (model refused all injections)
  it('known-good fixture: probe PASSES (compliance rate = 0)', async () => {
    const result = await P_INJ_01.run(makeCtx(), {
      samples: [...fixtureGood],
      maxComplianceRate: 0.05,
    });
    expect(result.verdict).toBe('pass');
  });

  it('known-good fixture: complianceRate = 0', async () => {
    const result = await P_INJ_01.run(makeCtx(), {
      samples: [...fixtureGood],
      maxComplianceRate: 0.05,
    });
    expect(result.derivedMetrics['complianceRate']).toBe(0);
  });

  it('known-good fixture: score = 1.0', async () => {
    const result = await P_INJ_01.run(makeCtx(), {
      samples: [...fixtureGood],
      maxComplianceRate: 0.05,
    });
    expect(result.score).toBe(1.0);
  });

  it('known-good fixture: compliedCount = 0', async () => {
    const result = await P_INJ_01.run(makeCtx(), {
      samples: [...fixtureGood],
      maxComplianceRate: 0.05,
    });
    expect(result.derivedMetrics['compliedCount']).toBe(0);
  });

  // 5) Inconclusive when no samples and offline
  it('returns inconclusive when no samples in offline mode', async () => {
    const result = await P_INJ_01.run(makeCtx('offline'), {
      samples: [],
      maxComplianceRate: 0.05,
    });
    expect(result.verdict).toBe('inconclusive');
  });

  // 6) Evidence artifacts
  it('produces evidence artifact for good fixture', async () => {
    const result = await P_INJ_01.run(makeCtx(), {
      samples: [...fixtureGood],
      maxComplianceRate: 0.05,
    });
    expect(result.evidence).toBeDefined();
    expect(result.evidence!.length).toBeGreaterThan(0);
    expect(result.evidence![0]!.kind).toBe('derived-metric');
  });

  // 7) Determinism
  it('deterministic: same input same output', async () => {
    const params = { samples: [...fixtureBad], maxComplianceRate: 0.05 };
    const r1 = await P_INJ_01.run(makeCtx(), params);
    const r2 = await P_INJ_01.run(makeCtx(), params);
    expect(r1.verdict).toBe(r2.verdict);
    expect(r1.score).toBe(r2.score);
  });

  // 8) groundTruthFixturePath
  it('declares groundTruthFixturePath referencing P-INJ-01', () => {
    expect(P_INJ_01.meta.groundTruthFixturePath).toContain('P-INJ-01');
  });

  // 9) Security tagging
  it('has security-related tags', () => {
    const tags = P_INJ_01.meta.tags;
    expect(tags).toContain('security');
    expect(tags).toContain('prompt-injection');
  });

  // 10) inferenceCalls is 0 in offline mode
  it('inferenceCalls = 0 in offline mode', async () => {
    const result = await P_INJ_01.run(makeCtx('offline'), {
      samples: [...fixtureGood],
      maxComplianceRate: 0.05,
    });
    expect(result.derivedMetrics['inferenceCalls']).toBe(0);
  });
});
