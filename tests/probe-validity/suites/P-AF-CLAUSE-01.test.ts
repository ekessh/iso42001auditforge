// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';

import {
  loadAnnexAControls,
  loadIso42001Clauses,
} from '@auditforge/catalogues';
import {
  KNOWN_BAD_FIXTURES,
  KNOWN_GOOD_FIXTURES,
  P_AF_CLAUSE_01,
  runHallucinationProbe,
  type ReRanker,
} from '../../../packages/probe-engine/src/probes/P-AF-CLAUSE-01.js';

interface IdRef { readonly id: string }
async function loadCatalogIds(): Promise<ReadonlySet<string>> {
  const [clauses, controls] = await Promise.all([
    loadIso42001Clauses(),
    loadAnnexAControls(),
  ]);
  return new Set([
    ...(clauses as readonly IdRef[]).map((c) => c.id),
    ...(controls as readonly IdRef[]).map((c) => c.id),
  ]);
}

function makeReRanker(outputs: readonly { readonly judgments: readonly { clauseId: string; confidence: number; rationale: string }[] }[]): ReRanker {
  return {
    rank: async (input) => {
      // Match by claim id; the fixtures use predictable ids "kg-NNN".
      const idx = parseInt(input.claim.id.replace(/^kg-0*/, ''), 10) - 1;
      const o = outputs[idx];
      if (!o) return { judgments: [] };
      return { judgments: o.judgments };
    },
  };
}

describe('P-AF-CLAUSE-01 (hallucination)', () => {
  it('passes on KNOWN_GOOD fixtures against the real catalog', async () => {
    const valid = await loadCatalogIds();
    const result = await runHallucinationProbe({
      corpus: KNOWN_GOOD_FIXTURES.corpus,
      reRanker: makeReRanker(KNOWN_GOOD_FIXTURES.outputs),
      validClauseIds: valid,
    });
    expect(result.valid).toBe(true);
    expect(result.invalidClauseIdsEmitted).toEqual([]);
    expect(result.totalEmitted).toBeGreaterThan(0);
  });

  it('FAILS on KNOWN_BAD fixtures and surfaces the fabricated ids', async () => {
    const valid = await loadCatalogIds();
    const result = await runHallucinationProbe({
      corpus: KNOWN_BAD_FIXTURES.corpus,
      reRanker: makeReRanker(KNOWN_BAD_FIXTURES.outputs),
      validClauseIds: valid,
    });
    expect(result.valid).toBe(false);
    expect(result.invalidClauseIdsEmitted.length).toBeGreaterThan(0);
    expect(result.invalidClauseIdsEmitted).toContain('A.99.99.99');
    expect(result.invalidClauseIdsEmitted).toContain('B.1.1');
    expect(result.invalidClauseIdsEmitted).toContain('NIST-AI-RMF-GV-1.1');
  });

  it('treats whitespace-only and case-mismatched ids as invalid', async () => {
    const valid = await loadCatalogIds();
    const result = await runHallucinationProbe({
      corpus: KNOWN_BAD_FIXTURES.corpus,
      reRanker: makeReRanker(KNOWN_BAD_FIXTURES.outputs),
      validClauseIds: valid,
    });
    // The KNOWN_BAD set includes a whitespace id and a lowercase 'a.10.3 '.
    expect(result.invalidClauseIdsEmitted).toContain('   ');
    expect(result.invalidClauseIdsEmitted).toContain('a.10.3 ');
  });

  it('probe definition is wired correctly (offline mode)', async () => {
    const ctx = {
      engagementId: '00000000-0000-0000-0000-000000000001',
      executionId: '00000000-0000-0000-0000-000000000002',
      mode: 'offline' as const,
      random: () => 0.5,
      inferenceClient: null,
      deadlineMs: Date.now() + 10_000,
      log: () => undefined,
    };
    const valid = await loadCatalogIds();
    const result = await P_AF_CLAUSE_01.run(ctx, {
      corpus: structuredClone(KNOWN_GOOD_FIXTURES.corpus) as never,
      reRankerOutputs: structuredClone(KNOWN_GOOD_FIXTURES.outputs) as never,
      validClauseIds: [...valid],
    });
    expect(result.verdict).toBe('pass');
    expect(result.score).toBe(1);
  });

  it('probe FAILS via run() when re-ranker emits a fabricated id', async () => {
    const ctx = {
      engagementId: '00000000-0000-0000-0000-000000000001',
      executionId: '00000000-0000-0000-0000-000000000002',
      mode: 'offline' as const,
      random: () => 0.5,
      inferenceClient: null,
      deadlineMs: Date.now() + 10_000,
      log: () => undefined,
    };
    const valid = await loadCatalogIds();
    const result = await P_AF_CLAUSE_01.run(ctx, {
      corpus: structuredClone(KNOWN_BAD_FIXTURES.corpus) as never,
      reRankerOutputs: structuredClone(KNOWN_BAD_FIXTURES.outputs) as never,
      validClauseIds: [...valid],
    });
    expect(result.verdict).toBe('fail');
    expect(result.score).toBe(0);
    expect(result.derivedMetrics.invalidCount).toBeGreaterThan(0);
  });

  it('every KNOWN_GOOD fixture id is a real catalog id', async () => {
    const valid = await loadCatalogIds();
    for (const out of KNOWN_GOOD_FIXTURES.outputs) {
      for (const j of out.judgments) {
        expect(valid.has(j.clauseId)).toBe(true);
      }
    }
  });

  it('controls map to A.6.2.6 (deployment correctness for AuditForge\'s own AI)', () => {
    expect(P_AF_CLAUSE_01.meta.controls.annexA).toContain('A.6.2.6');
    expect(P_AF_CLAUSE_01.meta.tags).toContain('release-gate');
  });
});
