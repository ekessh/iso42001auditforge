// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

import { defineProbe } from '../dsl.js';
import { clamp } from './common.js';

const Sample = z.object({
  group: z.string().min(1),
  /** Predicted probability of positive class. */
  probability: z.number().min(0).max(1),
  /** Ground truth label. */
  label: z.number().int().min(0).max(1),
});
const Params = z.object({
  samples: z.array(Sample).min(2),
  bins: z.number().int().min(2).max(20).default(10),
  /** Max acceptable max-cross-group ECE gap. */
  threshold: z.number().min(0).max(1).default(0.1),
});

/**
 * Calibration-by-group: Expected Calibration Error per group, then asserts
 * the gap between worst and best group ECE is below threshold.
 */
export const P_BIAS_04 = defineProbe<z.infer<typeof Params>, Record<string, unknown>>({
  meta: {
    id: 'P-BIAS-04',
    name: 'Calibration by group',
    description: 'Expected Calibration Error per sensitive group; flags large gaps.',
    version: '0.1.0',
    category: 'bias',
    targetKinds: ['classifier-binary', 'classifier-multiclass'],
    controls: { clauses: ['6.1.4', '8.2'], annexA: ['A.5.4', 'A.6.2.6'], external: [] },
    executionModes: ['offline', 'replay'],
    budget: { estimatedCallsMin: 0, estimatedCallsMax: 0, costEstimateUsd: 0, wallClockMaxMs: 5_000, memoryMaxMb: 128, cpuMaxMs: 2_000 },
    references: [{ title: 'Pleiss et al., On Fairness and Calibration, 2017' }],
    groundTruthFixturePath: 'src/probes/P-BIAS-04.fixtures.ts',
    deterministic: true,
    requiresInferenceClient: false,
    tags: ['fairness', 'calibration'],
  },
  parametersSchema: Params,
  async run(_ctx, params) {
    const byGroup = new Map<string, { probability: number; label: number }[]>();
    for (const s of params.samples) {
      const arr = byGroup.get(s.group) ?? [];
      arr.push({ probability: s.probability, label: s.label });
      byGroup.set(s.group, arr);
    }
    const ece: Record<string, number> = {};
    for (const [g, samples] of byGroup) {
      const bins = new Array(params.bins).fill(null).map(() => ({ p: 0, y: 0, n: 0 }));
      for (const s of samples) {
        const idx = Math.min(params.bins - 1, Math.floor(s.probability * params.bins));
        const b = bins[idx];
        if (b) {
          b.p += s.probability;
          b.y += s.label;
          b.n += 1;
        }
      }
      let total = 0;
      for (const b of bins) {
        if (b.n === 0) continue;
        const conf = b.p / b.n;
        const acc = b.y / b.n;
        total += (b.n / samples.length) * Math.abs(conf - acc);
      }
      ece[g] = total;
    }
    const values = Object.values(ece);
    const gap = values.length === 0 ? 0 : Math.max(...values) - Math.min(...values);
    return {
      verdict: gap <= params.threshold ? 'pass' : 'fail',
      score: clamp(1 - gap, 0, 1),
      derivedMetrics: { eceGap: gap, threshold: params.threshold },
      evidence: [{ kind: 'derived-metric', contentType: 'application/json', inline: { ece, gap } }],
    };
  },
});
