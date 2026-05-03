// SPDX-License-Identifier: BUSL-1.1
//
// FailureModeSampler: surfaces traces with errors / escalations / unexpected
// paths so the auditor can review a manageable sample rather than every
// trace in production.

import type { AgentTopology } from '../types/topology.js';
import type { AgentTrace } from '../types/trace.js';
import type { FailureSample } from '../reports/index.js';

export interface SamplerOptions {
  /** Maximum number of samples to return. Default 50. */
  maxSamples?: number;
  /** Cost threshold above which a trace is "high-cost". Default 1.0 USD. */
  highCostUsd?: number;
}

export class FailureModeSampler {
  sample(
    topology: AgentTopology | undefined,
    traces: readonly AgentTrace[],
    options: SamplerOptions = {},
  ): FailureSample[] {
    const max = options.maxSamples ?? 50;
    const highCost = options.highCostUsd ?? 1.0;
    const limit = topology?.recursionLimit ?? Number.POSITIVE_INFINITY;

    const declaredNodes = new Set(topology?.nodes.map((n) => n.name) ?? []);

    const samples: FailureSample[] = [];

    for (const t of traces) {
      if (samples.length >= max) break;
      if (t.errors.length > 0) {
        samples.push({
          traceId: t.id,
          reason: 'has-error',
          detail: `${t.errors.length} error span(s); first: ${t.errors[0]?.message ?? 'unknown'}`,
        });
        continue;
      }
      if (t.escalations.length > 0) {
        samples.push({
          traceId: t.id,
          reason: 'has-escalation',
          detail: `${t.escalations.length} escalation(s)`,
        });
        continue;
      }
      // Unexpected path: span name not present in topology nodes (when topology supplied).
      if (declaredNodes.size > 0) {
        const unknownNode = t.spans.find(
          (s) =>
            s.kind !== 'internal' &&
            s.kind !== 'unknown' &&
            !declaredNodes.has(s.name),
        );
        if (unknownNode) {
          samples.push({
            traceId: t.id,
            reason: 'unexpected-path',
            detail: `span "${unknownNode.name}" not declared in topology`,
          });
          continue;
        }
      }
      // Recursion limit breach
      if (Number.isFinite(limit)) {
        const counts = new Map<string, number>();
        for (const s of t.spans) {
          counts.set(s.name, (counts.get(s.name) ?? 0) + 1);
        }
        let worst = 0;
        for (const c of counts.values()) if (c > worst) worst = c;
        if (worst > limit) {
          samples.push({
            traceId: t.id,
            reason: 'recursion-limit',
            detail: `repeated node visits (${worst}) exceed declared limit (${limit})`,
          });
          continue;
        }
      }
      if (t.totalCostUsd >= highCost) {
        samples.push({
          traceId: t.id,
          reason: 'high-cost',
          detail: `trace cost USD ${t.totalCostUsd.toFixed(2)}`,
        });
      }
    }

    return samples;
  }
}
