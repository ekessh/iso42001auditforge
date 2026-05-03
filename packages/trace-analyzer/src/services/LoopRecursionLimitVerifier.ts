// SPDX-License-Identifier: BUSL-1.1
//
// LoopRecursionLimitVerifier: detects unbounded recursion in (a) the static
// topology, and (b) actual traces.
//
// Topology check: any cycle in the directed graph + no declared
// recursionLimit ==> "unbounded loop risk".
//
// Trace check: per-trace span count or repeated visits to the same node id
// > recursionLimit (when set) ==> "recursion limit exceeded".

import type { AgentTopology } from '../types/topology.js';
import type { AgentTrace } from '../types/trace.js';

export interface CycleFinding {
  nodes: string[];
  detail: string;
}

export interface LoopVerifierReport {
  topologyId: string;
  cycles: CycleFinding[];
  declaredRecursionLimit?: number;
  unboundedRisk: boolean;
  traceFindings: Array<{
    traceId: string;
    repeatedNode: string;
    visits: number;
    breachesLimit: boolean;
  }>;
}

export class LoopRecursionLimitVerifier {
  findCycles(topology: AgentTopology): CycleFinding[] {
    const adjacency = new Map<string, string[]>();
    for (const e of topology.edges) {
      const list = adjacency.get(e.from) ?? [];
      list.push(e.to);
      adjacency.set(e.from, list);
    }
    const cycles: CycleFinding[] = [];
    const seen = new Set<string>();
    const stack: string[] = [];
    const onStack = new Set<string>();

    const dfs = (n: string): void => {
      if (onStack.has(n)) {
        const idx = stack.indexOf(n);
        const cyc = stack.slice(idx).concat(n);
        cycles.push({
          nodes: cyc,
          detail: `Cycle: ${cyc.join(' -> ')}`,
        });
        return;
      }
      if (seen.has(n)) return;
      seen.add(n);
      onStack.add(n);
      stack.push(n);
      for (const next of adjacency.get(n) ?? []) dfs(next);
      stack.pop();
      onStack.delete(n);
    };

    for (const node of topology.nodes) dfs(node.id);
    // De-duplicate cycles with same node set (rotated representations).
    const dedup: CycleFinding[] = [];
    const seenKeys = new Set<string>();
    for (const c of cycles) {
      const key = [...new Set(c.nodes)].sort().join('|');
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        dedup.push(c);
      }
    }
    return dedup;
  }

  verify(
    topology: AgentTopology,
    traces: readonly AgentTrace[],
  ): LoopVerifierReport {
    const cycles = this.findCycles(topology);
    const unboundedRisk =
      cycles.length > 0 && topology.recursionLimit === undefined;

    const limit = topology.recursionLimit ?? Number.POSITIVE_INFINITY;
    const traceFindings: LoopVerifierReport['traceFindings'] = [];
    for (const t of traces) {
      const visits = new Map<string, number>();
      for (const s of t.spans) {
        visits.set(s.name, (visits.get(s.name) ?? 0) + 1);
      }
      let worstName = '';
      let worstCount = 0;
      for (const [name, count] of visits.entries()) {
        if (count > worstCount) {
          worstCount = count;
          worstName = name;
        }
      }
      if (worstCount > 1) {
        traceFindings.push({
          traceId: t.id,
          repeatedNode: worstName,
          visits: worstCount,
          breachesLimit: worstCount > limit,
        });
      }
    }

    const report: LoopVerifierReport = {
      topologyId: topology.id,
      cycles,
      unboundedRisk,
      traceFindings,
    };
    if (topology.recursionLimit !== undefined) {
      report.declaredRecursionLimit = topology.recursionLimit;
    }
    return report;
  }
}
