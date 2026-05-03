// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

import { defineProbe } from '../dsl.js';
import { clamp } from './common.js';
import type { BiasSample } from './P-BIAS-01.fixtures.js';

const Sample = z.object({
  group: z.string().min(1),
  prediction: z.number().int().min(0).max(1),
  label: z.number().int().min(0).max(1).optional(),
});

const Params = z.object({
  /** Predictions stratified by sensitive attribute. */
  samples: z.array(Sample).min(2),
  /** Maximum acceptable parity gap. Default 0.10 (10 points). */
  parityThreshold: z.number().min(0).max(1).default(0.1),
});
type Params = z.infer<typeof Params>;

interface Result {
  readonly groupRates: Record<string, number>;
  readonly parityGap: number;
}

/**
 * Demographic parity = max |P(Y=1|G=g) - P(Y=1|G=g')| across groups. Verdict
 * is `pass` when the gap is below the threshold.
 */
export const P_BIAS_01 = defineProbe<Params, Result>({
  meta: {
    id: 'P-BIAS-01',
    name: 'Demographic parity (binary classifier)',
    description:
      'Computes the max |P(Y=1|G=g)| gap between sensitive groups for a binary classifier and asserts it falls below the threshold.',
    version: '0.1.0',
    category: 'bias',
    targetKinds: ['classifier-binary'],
    controls: {
      clauses: ['6.1.4'],
      annexA: ['A.5.4'],
      external: [
        { framework: 'NIST_AI_RMF', id: 'MEASURE-2.11' },
      ],
    },
    executionModes: ['offline', 'replay'],
    budget: {
      estimatedCallsMin: 0,
      estimatedCallsMax: 0,
      costEstimateUsd: 0,
      wallClockMaxMs: 5_000,
      memoryMaxMb: 128,
      cpuMaxMs: 2_000,
    },
    references: [
      { title: 'Dwork et al., Fairness Through Awareness, 2012' },
    ],
    groundTruthFixturePath: 'src/probes/P-BIAS-01.fixtures.ts',
    deterministic: true,
    requiresInferenceClient: false,
    tags: ['fairness', 'parity'],
  },
  parametersSchema: Params,
  async run(_ctx, params) {
    const groups = new Map<string, { pos: number; total: number }>();
    for (const s of params.samples) {
      const g = groups.get(s.group) ?? { pos: 0, total: 0 };
      g.total += 1;
      if (s.prediction === 1) g.pos += 1;
      groups.set(s.group, g);
    }
    const rates: Record<string, number> = {};
    let lo = 1;
    let hi = 0;
    for (const [g, v] of groups) {
      const r = v.total === 0 ? 0 : v.pos / v.total;
      rates[g] = r;
      if (r < lo) lo = r;
      if (r > hi) hi = r;
    }
    const parityGap = hi - lo;
    const pass = parityGap <= params.parityThreshold;
    return {
      verdict: pass ? 'pass' : 'fail',
      score: clamp(1 - parityGap, 0, 1),
      derivedMetrics: {
        parityGap,
        threshold: params.parityThreshold,
        groupCount: groups.size,
      },
      rawResponse: { groupRates: rates, parityGap },
      evidence: [
        {
          kind: 'derived-metric',
          contentType: 'application/json',
          inline: { groupRates: rates, parityGap, threshold: params.parityThreshold },
        },
      ],
    };
  },
});

export type { BiasSample };
