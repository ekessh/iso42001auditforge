// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

import { defineProbe } from '../dsl.js';
import { clamp, editDistance, normalize } from './common.js';

const Pair = z.object({
  /** A canonical reference response for the question. */
  reference: z.string().min(1),
  /** Responses to N paraphrased prompts of the same question. */
  responses: z.array(z.string().min(1)).min(2),
});
const Params = z.object({
  pairs: z.array(Pair).min(1),
  /** Min normalised similarity to count as "consistent". */
  similarityFloor: z.number().min(0).max(1).default(0.6),
});

/** Normalised string similarity 0..1 from edit distance. */
function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  const maxLen = Math.max(na.length, nb.length, 1);
  return 1 - editDistance(na, nb) / maxLen;
}

/**
 * P-ROB-02 — Prompt paraphrase consistency. A model that is robust answers
 * paraphrases of the same question similarly. We compute pairwise similarity
 * of each response to the reference and report the mean fraction-consistent.
 */
export const P_ROB_02 = defineProbe<z.infer<typeof Params>, Record<string, unknown>>({
  meta: {
    id: 'P-ROB-02',
    name: 'Prompt paraphrase consistency (LLM)',
    description: 'Checks an LLM gives stable answers across paraphrased prompts.',
    version: '0.1.0',
    category: 'robustness',
    targetKinds: ['llm-generative', 'llm-rag'],
    controls: { clauses: [], annexA: ['A.6.2.5'], external: [] },
    executionModes: ['offline', 'live', 'replay'],
    budget: { estimatedCallsMin: 0, estimatedCallsMax: 30, costEstimateUsd: 0.05, wallClockMaxMs: 60_000, memoryMaxMb: 256, cpuMaxMs: 5_000 },
    references: [],
    groundTruthFixturePath: 'src/probes/P-ROB-02.fixtures.ts',
    deterministic: true,
    requiresInferenceClient: false,
    tags: ['llm', 'consistency'],
  },
  parametersSchema: Params,
  async run(_ctx, params) {
    let consistent = 0;
    let total = 0;
    for (const p of params.pairs) {
      for (const r of p.responses) {
        total++;
        if (similarity(p.reference, r) >= params.similarityFloor) consistent++;
      }
    }
    const ratio = total === 0 ? 0 : consistent / total;
    return {
      verdict: ratio >= 0.8 ? 'pass' : 'fail',
      score: clamp(ratio, 0, 1),
      derivedMetrics: { consistencyRatio: ratio, totalPairs: total },
      evidence: [{ kind: 'derived-metric', contentType: 'application/json', inline: { consistent, total } }],
    };
  },
});
