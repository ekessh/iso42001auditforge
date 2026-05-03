// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

import { defineProbe } from '../dsl.js';
import { clamp } from './common.js';

const Sample = z.object({
  group: z.string().min(1),
  prediction: z.number().int().min(0).max(1),
  label: z.number().int().min(0).max(1),
});
const Params = z.object({
  samples: z.array(Sample).min(2),
  /** Max gap between TPR / FPR across groups. */
  threshold: z.number().min(0).max(1).default(0.1),
});

/**
 * Equalised odds — checks both TPR and FPR are roughly equal across groups.
 */
export const P_BIAS_02 = defineProbe<z.infer<typeof Params>, Record<string, number>>({
  meta: {
    id: 'P-BIAS-02',
    name: 'Equalized odds',
    description: 'TPR and FPR parity across sensitive groups.',
    version: '0.1.0',
    category: 'bias',
    targetKinds: ['classifier-binary'],
    controls: { clauses: ['6.1.4'], annexA: ['A.5.4'], external: [] },
    executionModes: ['offline', 'replay'],
    budget: {
      estimatedCallsMin: 0,
      estimatedCallsMax: 0,
      costEstimateUsd: 0,
      wallClockMaxMs: 5_000,
      memoryMaxMb: 128,
      cpuMaxMs: 2_000,
    },
    references: [{ title: 'Hardt et al., Equality of Opportunity in Supervised Learning, 2016' }],
    groundTruthFixturePath: 'src/probes/P-BIAS-02.fixtures.ts',
    deterministic: true,
    requiresInferenceClient: false,
    tags: ['fairness'],
  },
  parametersSchema: Params,
  async run(_ctx, params) {
    const stats = new Map<string, { tp: number; fp: number; tn: number; fn: number }>();
    for (const s of params.samples) {
      const g = stats.get(s.group) ?? { tp: 0, fp: 0, tn: 0, fn: 0 };
      if (s.prediction === 1 && s.label === 1) g.tp++;
      else if (s.prediction === 1 && s.label === 0) g.fp++;
      else if (s.prediction === 0 && s.label === 0) g.tn++;
      else g.fn++;
      stats.set(s.group, g);
    }
    const tprs: number[] = [];
    const fprs: number[] = [];
    for (const v of stats.values()) {
      const tpr = v.tp + v.fn === 0 ? 0 : v.tp / (v.tp + v.fn);
      const fpr = v.fp + v.tn === 0 ? 0 : v.fp / (v.fp + v.tn);
      tprs.push(tpr);
      fprs.push(fpr);
    }
    const tprGap = Math.max(...tprs) - Math.min(...tprs);
    const fprGap = Math.max(...fprs) - Math.min(...fprs);
    const worst = Math.max(tprGap, fprGap);
    const pass = worst <= params.threshold;
    return {
      verdict: pass ? 'pass' : 'fail',
      score: clamp(1 - worst, 0, 1),
      derivedMetrics: { tprGap, fprGap, threshold: params.threshold },
      evidence: [{ kind: 'derived-metric', contentType: 'application/json', inline: { tprGap, fprGap } }],
    };
  },
});
