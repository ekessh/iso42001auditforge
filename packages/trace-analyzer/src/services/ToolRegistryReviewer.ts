// SPDX-License-Identifier: BUSL-1.1
//
// ToolRegistryReviewer: classifies tools by sensitivity, builds the tool-
// permission graph, and detects ACL drift between declared permissions and
// observed tool calls in traces.

import type { AgentTopology, AgentTool } from '../types/topology.js';
import type { AgentTrace } from '../types/trace.js';
import {
  type ToolAclDrift,
  type ToolAclDriftReport,
} from '../reports/index.js';
import { renderDot, type DotEdge, type DotNode } from '../util/dot.js';
import { classifySensitivityHeuristic } from '../importers/topology.js';

export interface PermissionGraph {
  dot: string;
  json: {
    nodes: Array<{ id: string; kind: 'agent' | 'tool'; sensitivity?: string }>;
    edges: Array<{ from: string; to: string; sensitivity: string }>;
  };
}

export class ToolRegistryReviewer {
  /**
   * Classify any tool whose sensitivity is "unset" by name heuristic.
   * Auditors are expected to confirm/override; this is a starter classification.
   */
  classify(tools: readonly AgentTool[]): AgentTool[] {
    return tools.map((t) => {
      // If the importer left a fall-back "read", we don't override. But if
      // the tool's name strongly implies destructive, surface an upgrade.
      const heuristic = classifySensitivityHeuristic(t.name);
      // Only escalate sensitivity (read -> write -> destructive); never
      // downgrade auditor-confirmed values.
      const order = { read: 0, write: 1, destructive: 2 } as const;
      const next =
        order[heuristic] > order[t.sensitivity] ? heuristic : t.sensitivity;
      return { ...t, sensitivity: next };
    });
  }

  /**
   * Detect tools used by agent roles that are not in the tool's declaredAcl.
   * Returns a structured report including unused / undeclared tools.
   */
  detectAclDrift(
    topology: AgentTopology,
    traces: readonly AgentTrace[],
  ): ToolAclDriftReport {
    const toolById = new Map(topology.tools.map((t) => [t.id, t]));
    const observedByTool = new Map<string, Map<string, number>>();
    const undeclared = new Set<string>();

    for (const trace of traces) {
      for (const tc of trace.toolCalls) {
        const declared = toolById.get(tc.toolId);
        const invoker = tc.invokedBy ?? 'unknown';
        if (!declared) {
          undeclared.add(tc.toolId);
          continue;
        }
        if (!observedByTool.has(tc.toolId)) {
          observedByTool.set(tc.toolId, new Map());
        }
        const m = observedByTool.get(tc.toolId);
        if (m) m.set(invoker, (m.get(invoker) ?? 0) + 1);
      }
    }

    const drifts: ToolAclDrift[] = [];
    const unused: string[] = [];
    for (const tool of topology.tools) {
      const observed = observedByTool.get(tool.id);
      if (!observed) {
        unused.push(tool.id);
        continue;
      }
      const observedInvokers = [...observed.keys()];
      // declaredAcl == [] means "no agents are explicitly permitted". In
      // practice we treat empty ACL as "permissive" only when the tool is
      // read-only; for write/destructive tools, empty ACL means
      // "everything is unauthorised".
      const allowAll =
        tool.declaredAcl.length === 0 && tool.sensitivity === 'read';
      const unauthorised = allowAll
        ? []
        : observedInvokers.filter((r) => !tool.declaredAcl.includes(r));
      const occurrences = [...observed.values()].reduce((a, b) => a + b, 0);
      if (unauthorised.length > 0 || allowAll === false && tool.declaredAcl.length === 0 && observedInvokers.length > 0) {
        drifts.push({
          toolId: tool.id,
          toolName: tool.name,
          declaredAcl: tool.declaredAcl,
          observedInvokers,
          unauthorisedInvokers: unauthorised,
          occurrences,
          sensitivity: tool.sensitivity,
        });
      }
    }

    return {
      topologyId: topology.id,
      totalTraces: traces.length,
      drifts,
      unusedTools: unused,
      undeclaredTools: [...undeclared].sort(),
    };
  }

  /** Render the tool-permission graph in DOT and JSON forms for the UI. */
  buildPermissionGraph(topology: AgentTopology): PermissionGraph {
    const nodes: DotNode[] = [];
    const edges: DotEdge[] = [];
    const jsonNodes: PermissionGraph['json']['nodes'] = [];
    const jsonEdges: PermissionGraph['json']['edges'] = [];

    const seenAgents = new Set<string>();
    for (const role of new Set(
      topology.tools.flatMap((t) => t.declaredAcl),
    )) {
      seenAgents.add(role);
      nodes.push({ id: `agent:${role}`, label: role, shape: 'oval' });
      jsonNodes.push({ id: role, kind: 'agent' });
    }

    for (const tool of topology.tools) {
      const fillcolor =
        tool.sensitivity === 'destructive'
          ? '#fca5a5'
          : tool.sensitivity === 'write'
            ? '#fde68a'
            : '#a7f3d0';
      nodes.push({
        id: `tool:${tool.id}`,
        label: `${tool.name}\n(${tool.sensitivity})`,
        shape: 'box',
        fillcolor,
      });
      jsonNodes.push({
        id: tool.id,
        kind: 'tool',
        sensitivity: tool.sensitivity,
      });
      for (const role of tool.declaredAcl) {
        if (!seenAgents.has(role)) {
          seenAgents.add(role);
          nodes.push({ id: `agent:${role}`, label: role, shape: 'oval' });
          jsonNodes.push({ id: role, kind: 'agent' });
        }
        edges.push({
          from: `agent:${role}`,
          to: `tool:${tool.id}`,
          label: tool.sensitivity,
        });
        jsonEdges.push({
          from: role,
          to: tool.id,
          sensitivity: tool.sensitivity,
        });
      }
    }

    return {
      dot: renderDot(`${topology.id}-permissions`, nodes, edges),
      json: { nodes: jsonNodes, edges: jsonEdges },
    };
  }
}
