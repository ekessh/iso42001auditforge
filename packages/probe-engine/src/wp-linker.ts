// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

import type { ProbeExecution } from './types.js';

/**
 * Working-paper linker. Translates a `ProbeExecution` into a structured
 * artifact the working-papers module consumes verbatim. We deliberately keep
 * the schema small so working-papers can render it without re-parsing probe
 * internals.
 */
export const WorkingPaperProbeArtifactSchema = z.object({
  executionId: z.string().uuid(),
  engagementId: z.string().uuid(),
  probeId: z.string(),
  probeVersion: z.string(),
  category: z.string(),
  controls: z.object({
    clauses: z.array(z.string()),
    annexA: z.array(z.string()),
    external: z.array(
      z.object({ framework: z.string(), id: z.string() }),
    ),
  }),
  verdict: z.enum(['pass', 'fail', 'inconclusive', 'error']),
  score: z.number().min(0).max(1).optional(),
  summary: z.string().min(1).max(2_000),
  derivedMetrics: z.record(z.union([z.number(), z.string(), z.boolean()])),
  evidenceCount: z.number().int().nonnegative(),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  /** True when verdict warrants a finding draft. */
  suggestFinding: z.boolean(),
});
export type WorkingPaperProbeArtifact = z.infer<typeof WorkingPaperProbeArtifactSchema>;

export interface WpLinkerOptions {
  /** Looks up control mapping for a probe id (we do not import probe metadata into WP). */
  resolveControls: (probeId: string) => {
    clauses: readonly string[];
    annexA: readonly string[];
    external: ReadonlyArray<{ framework: string; id: string }>;
    category: string;
  };
}

export class WorkingPaperLinker {
  constructor(private readonly opts: WpLinkerOptions) {}

  link(exec: ProbeExecution): WorkingPaperProbeArtifact {
    const ctrls = this.opts.resolveControls(exec.probeId);
    const summary = this.summarise(exec);
    return WorkingPaperProbeArtifactSchema.parse({
      executionId: exec.id,
      engagementId: exec.engagementId,
      probeId: exec.probeId,
      probeVersion: exec.probeVersion,
      category: ctrls.category,
      controls: {
        clauses: [...ctrls.clauses],
        annexA: [...ctrls.annexA],
        external: ctrls.external.map((e) => ({ ...e })),
      },
      verdict: exec.verdict,
      score: exec.score,
      summary,
      derivedMetrics: exec.derivedMetrics,
      evidenceCount: exec.evidenceArtifacts.length,
      startedAt: exec.startedAt,
      completedAt: exec.completedAt,
      suggestFinding: exec.verdict === 'fail',
    });
  }

  private summarise(exec: ProbeExecution): string {
    if (exec.verdict === 'error') {
      const first = exec.errors[0];
      return `Probe ${exec.probeId} errored: ${first?.code ?? 'unknown'}.`;
    }
    const metricCount = Object.keys(exec.derivedMetrics).length;
    const scoreStr = exec.score !== undefined ? ` score=${exec.score.toFixed(3)}` : '';
    return `Probe ${exec.probeId}@${exec.probeVersion} verdict=${exec.verdict}${scoreStr} (${metricCount} metrics).`;
  }
}
