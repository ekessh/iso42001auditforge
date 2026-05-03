// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

import { defineProbe } from '../dsl.js';
import { clamp } from './common.js';

const Sample = z.object({
  group: z.string().min(1),
  prediction: z.number().int().min(0).max(1),
});
const Params = z.object({
  samples: z.array(Sample).min(2),
  privilegedGroup: z.string().min(1),
  /** EEOC 80 % rule: ratio < 0.8 = disparate impact. */
  ratioFloor: z.number().min(0).max(1).default(0.8),
});

/**
 * Disparate-impact ratio (EEOC four-fifths rule).
 */
export const P_BIAS_03 = defineProbe<z.infer<typeof Params>, Record<string, unknown>>({
  meta: {
    id: 'P-BIAS-03',
    name: 'Disparate impact (4/5 rule)',
    description: 'Ratio of positive-prediction rate of unprivileged vs privileged group.',
    version: '0.1.0',
    category: 'bias',
    targetKinds: ['classifier-binary', 'classifier-multiclass'],
    controls: { clauses: ['6.1.4'], annexA: ['A.5.4'], external: [{ framework: 'EU_AI_ACT', id: 'Art.10' }] },
    executionModes: ['offline', 'replay'],
    budget: { estimatedCallsMin: 0, estimatedCallsMax: 0, costEstimateUsd: 0, wallClockMaxMs: 5_000, memoryMaxMb: 128, cpuMaxMs: 2_000 },
    references: [{ title: 'EEOC Uniform Guidelines on Employee Selection Procedures, 1978' }],
    groundTruthFixturePath: 'src/probes/P-BIAS-03.fixtures.ts',
    deterministic: true,
    requiresInferenceClient: false,
    tags: ['fairness', 'eeoc'],
  },
  parametersSchema: Params,
  async run(_ctx, params) {
    const groups = new Map<string, { pos: number; total: number }>();
    for (const s of params.samples) {
      const g = groups.get(s.group) ?? { pos: 0, total: 0 };
      g.total++;
      if (s.prediction === 1) g.pos++;
      groups.set(s.group, g);
    }
    const priv = groups.get(params.privilegedGroup);
    if (!priv || priv.total === 0) {
      return {
        verdict: 'inconclusive',
        score: 0,
        derivedMetrics: { reason: 'no privileged group samples' },
      };
    }
    const privRate = priv.pos / priv.total;
    if (privRate === 0) {
      return { verdict: 'inconclusive', score: 0, derivedMetrics: { privRate: 0 } };
    }
    let worstRatio = 1;
    const ratios: Record<string, number> = {};
    for (const [g, v] of groups) {
      if (g === params.privilegedGroup) continue;
      const r = v.total === 0 ? 0 : v.pos / v.total;
      const ratio = r / privRate;
      ratios[g] = ratio;
      if (ratio < worstRatio) worstRatio = ratio;
    }
    const pass = worstRatio >= params.ratioFloor;
    return {
      verdict: pass ? 'pass' : 'fail',
      score: clamp(worstRatio, 0, 1),
      derivedMetrics: { worstRatio, ratioFloor: params.ratioFloor, privRate },
      evidence: [{ kind: 'derived-metric', contentType: 'application/json', inline: { ratios, privRate } }],
    };
  },
});
