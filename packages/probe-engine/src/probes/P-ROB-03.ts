// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

import { defineProbe } from '../dsl.js';
import { clamp } from './common.js';

const Sample = z.object({
  baselineCorrect: z.number().int().min(0).max(1),
  noisyCorrect: z.number().int().min(0).max(1),
  noiseLevel: z.number().min(0).max(1),
});
const Params = z.object({
  samples: z.array(Sample).min(5),
  maxDrop: z.number().min(0).max(1).default(0.15),
});

export const P_ROB_03 = defineProbe<z.infer<typeof Params>, Record<string, unknown>>({
  meta: {
    id: 'P-ROB-03',
    name: 'Input noise tolerance',
    description: 'Compares accuracy on clean vs randomly perturbed (typo/noise) inputs.',
    version: '0.1.0',
    category: 'robustness',
    targetKinds: ['classifier-binary', 'classifier-multiclass', 'llm-generative'],
    controls: { clauses: [], annexA: ['A.6.2.5'], external: [] },
    executionModes: ['offline', 'replay'],
    budget: { estimatedCallsMin: 0, estimatedCallsMax: 0, costEstimateUsd: 0, wallClockMaxMs: 5_000, memoryMaxMb: 128, cpuMaxMs: 2_000 },
    references: [],
    groundTruthFixturePath: 'src/probes/P-ROB-03.fixtures.ts',
    deterministic: true,
    requiresInferenceClient: false,
    tags: ['robustness'],
  },
  parametersSchema: Params,
  async run(_ctx, params) {
    let baseline = 0;
    let noisy = 0;
    for (const s of params.samples) {
      baseline += s.baselineCorrect;
      noisy += s.noisyCorrect;
    }
    const baselineAcc = baseline / params.samples.length;
    const noisyAcc = noisy / params.samples.length;
    const drop = Math.max(0, baselineAcc - noisyAcc);
    return {
      verdict: drop <= params.maxDrop ? 'pass' : 'fail',
      score: clamp(1 - drop, 0, 1),
      derivedMetrics: { baselineAcc, noisyAcc, drop },
      evidence: [{ kind: 'derived-metric', contentType: 'application/json', inline: { baselineAcc, noisyAcc, drop } }],
    };
  },
});
