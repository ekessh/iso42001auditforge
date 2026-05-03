// SPDX-License-Identifier: BUSL-1.1
//
// MultiAgentCoordinationReviewer: validates orchestrator authority, worker
// isolation, and message-protocol soundness for multi-agent topologies.
//
// Heuristics
// - Orchestrator authority: there should exist a single agent node that is
//   the only one with edges into worker agents (or workers only fan back
//   into the orchestrator).
// - Worker isolation: workers should not share tools beyond declared ACL.
// - Message protocol: edges should be either unconditional or conditional;
//   we check that conditional edges have non-empty conditions.

import type { AgentTopology } from '../types/topology.js';

export interface CoordinationFinding {
  kind:
    | 'no-orchestrator'
    | 'multiple-orchestrators'
    | 'worker-fanout'
    | 'shared-destructive-tool'
    | 'unlabelled-conditional-edge';
  detail: string;
  affected: string[];
}

export interface CoordinationReport {
  topologyId: string;
  orchestratorCandidate?: string;
  findings: CoordinationFinding[];
  workerCount: number;
}

export class MultiAgentCoordinationReviewer {
  review(topology: AgentTopology): CoordinationReport {
    const agents = topology.nodes.filter((n) => n.kind === 'agent');
    const findings: CoordinationFinding[] = [];

    // Orchestrator detection: agent with the highest fan-out among agents.
    const fanOut = new Map<string, number>();
    for (const e of topology.edges) {
      const fromNode = topology.nodes.find((n) => n.id === e.from);
      const toNode = topology.nodes.find((n) => n.id === e.to);
      if (fromNode?.kind === 'agent' && toNode?.kind === 'agent') {
        fanOut.set(e.from, (fanOut.get(e.from) ?? 0) + 1);
      }
    }
    const sortedAgents = [...fanOut.entries()].sort((a, b) => b[1] - a[1]);
    const orchestrator = sortedAgents[0]?.[0];
    const top2 = sortedAgents[1];
    if (!orchestrator && agents.length > 1) {
      findings.push({
        kind: 'no-orchestrator',
        detail: 'No agent has fan-out edges; no clear orchestrator',
        affected: agents.map((a) => a.id),
      });
    }
    if (
      orchestrator &&
      top2 &&
      sortedAgents[0]?.[1] === top2[1] &&
      top2[1] > 1
    ) {
      findings.push({
        kind: 'multiple-orchestrators',
        detail: `Multiple agents share top fan-out (${top2[1]}): ${orchestrator}, ${top2[0]}`,
        affected: [orchestrator, top2[0]],
      });
    }

    // Worker isolation: any worker that has fan-out > 0 to another worker.
    const workerIds = agents
      .map((a) => a.id)
      .filter((id) => id !== orchestrator);
    for (const w of workerIds) {
      const outboundToWorker = topology.edges.filter(
        (e) => e.from === w && workerIds.includes(e.to),
      );
      if (outboundToWorker.length > 0) {
        findings.push({
          kind: 'worker-fanout',
          detail: `Worker "${w}" has direct edges to other workers (${outboundToWorker.map((e) => e.to).join(', ')})`,
          affected: [w, ...outboundToWorker.map((e) => e.to)],
        });
      }
    }

    // Shared destructive tools: any destructive tool in declaredAcl of >1 role.
    for (const tool of topology.tools) {
      if (tool.sensitivity === 'destructive' && tool.declaredAcl.length > 1) {
        findings.push({
          kind: 'shared-destructive-tool',
          detail: `Destructive tool "${tool.id}" is permitted to multiple roles: ${tool.declaredAcl.join(', ')}`,
          affected: [tool.id, ...tool.declaredAcl],
        });
      }
    }

    // Unlabelled conditional edges: an edge whose source has more than one
    // outgoing edge but whose `condition` is missing.
    const outgoingByNode = new Map<string, number>();
    for (const e of topology.edges)
      outgoingByNode.set(e.from, (outgoingByNode.get(e.from) ?? 0) + 1);
    for (const e of topology.edges) {
      const out = outgoingByNode.get(e.from) ?? 0;
      if (out > 1 && (!e.condition || e.condition.trim() === '')) {
        findings.push({
          kind: 'unlabelled-conditional-edge',
          detail: `Edge ${e.from} -> ${e.to} has siblings but no condition`,
          affected: [e.from, e.to],
        });
      }
    }

    const report: CoordinationReport = {
      topologyId: topology.id,
      findings,
      workerCount: workerIds.length,
    };
    if (orchestrator !== undefined) {
      report.orchestratorCandidate = orchestrator;
    }
    return report;
  }
}
