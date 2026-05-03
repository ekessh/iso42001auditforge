// SPDX-License-Identifier: BUSL-1.1
//
// Topology importers. Each vendor format gets normalised into AgentTopology.
//
// Design notes:
// - We accept loose vendor JSON (vendors evolve their schemas) and validate
//   via Zod only when fields are required for downstream analysis.
// - LangGraph: state-graph JSON with `nodes` (agent or tool) and `edges`
//   (sometimes conditional). Recursion limit is honoured if present.
// - CrewAI: agents + tasks; tasks have a sequential or hierarchical flow.
//   We treat agents as nodes and synthesise edges from task ordering.
// - AutoGen: agents + group-chat configuration; we treat the group-chat as
//   a fully-connected subgraph routed by the manager agent.
// - CustomJSON: pre-normalised; we just validate.

import {
  AgentTopologySchema,
  type AgentTopology,
  type AgentTool,
  type TopologyEdge,
  type TopologyNode,
  type ToolSensitivity,
} from '../types/topology.js';

export interface TopologyImporter {
  readonly format: AgentTopology['format'];
  parse(input: unknown): AgentTopology;
}

function classifySensitivityHeuristic(name: string): ToolSensitivity {
  const lower = name.toLowerCase();
  if (
    /(delete|drop|destroy|remove|terminate|kill|shutdown|wipe|purge)/.test(
      lower,
    )
  ) {
    return 'destructive';
  }
  if (/(write|update|create|insert|patch|post|send|publish|execute|run)/.test(lower)) {
    return 'write';
  }
  return 'read';
}

// ---------- LangGraph ----------

export const LangGraphImporter: TopologyImporter = {
  format: 'langgraph',
  parse(input: unknown): AgentTopology {
    if (typeof input !== 'object' || input === null) {
      throw new Error('LangGraph topology must be an object');
    }
    const obj = input as Record<string, unknown>;
    const id =
      typeof obj.id === 'string' ? obj.id : `langgraph-${Date.now()}`;
    const name =
      typeof obj.name === 'string' ? obj.name : 'langgraph-topology';

    const rawNodes = (obj.nodes as unknown[]) ?? [];
    const rawEdges = (obj.edges as unknown[]) ?? [];
    const rawTools = (obj.tools as unknown[]) ?? [];

    const nodes: TopologyNode[] = rawNodes.map((n) => {
      const node = n as Record<string, unknown>;
      const kindStr = typeof node.kind === 'string' ? node.kind : 'agent';
      const isHitl =
        node.is_hitl_gate === true ||
        node.hitl_gate === true ||
        kindStr === 'gate';
      return {
        id: String(node.id ?? node.name),
        kind:
          kindStr === 'tool'
            ? 'tool'
            : kindStr === 'router'
              ? 'router'
              : isHitl
                ? 'gate'
                : 'agent',
        name: String(node.name ?? node.id),
        toolId: typeof node.tool_id === 'string' ? node.tool_id : undefined,
        role: typeof node.role === 'string' ? node.role : undefined,
        isHitlGate: isHitl,
        metadata: (node.metadata as Record<string, unknown>) ?? {},
      };
    });

    const edges: TopologyEdge[] = rawEdges.map((e) => {
      const edge = e as Record<string, unknown>;
      return {
        from: String(edge.from ?? edge.source),
        to: String(edge.to ?? edge.target),
        condition:
          typeof edge.condition === 'string' ? edge.condition : undefined,
      };
    });

    const tools: AgentTool[] = rawTools.map((t) => {
      const tool = t as Record<string, unknown>;
      const toolName = String(tool.name ?? tool.id);
      const sensitivity =
        (tool.sensitivity as ToolSensitivity | undefined) ??
        classifySensitivityHeuristic(toolName);
      return {
        id: String(tool.id ?? tool.name),
        name: toolName,
        sensitivity,
        schema: {
          params:
            ((tool.params as Array<Record<string, unknown>>) ?? []).map(
              (p) => ({
                name: String(p.name),
                type: String(p.type ?? 'unknown'),
                description:
                  typeof p.description === 'string' ? p.description : undefined,
                required: p.required === true,
              }),
            ),
          returnType:
            typeof tool.return_type === 'string'
              ? tool.return_type
              : undefined,
        },
        declaredAcl: Array.isArray(tool.declared_acl)
          ? (tool.declared_acl as string[]).map(String)
          : Array.isArray(tool.acl)
            ? (tool.acl as string[]).map(String)
            : [],
        description:
          typeof tool.description === 'string' ? tool.description : undefined,
      };
    });

    let entry: string[];
    if (Array.isArray(obj.entry)) {
      entry = (obj.entry as unknown[]).map(String);
    } else if (typeof obj.entry === 'string') {
      entry = [obj.entry];
    } else if (typeof obj.entry_point === 'string') {
      entry = [obj.entry_point];
    } else {
      // Fall back to nodes with no incoming edges.
      const incoming = new Set(edges.map((e) => e.to));
      entry = nodes.filter((n) => !incoming.has(n.id)).map((n) => n.id);
      if (entry.length === 0 && nodes.length > 0)
        entry = [nodes[0]?.id ?? ''].filter((s) => s.length > 0);
    }

    let exit: string[];
    if (Array.isArray(obj.exit)) {
      exit = (obj.exit as unknown[]).map(String);
    } else if (typeof obj.exit === 'string') {
      exit = [obj.exit];
    } else {
      const outgoing = new Set(edges.map((e) => e.from));
      exit = nodes.filter((n) => !outgoing.has(n.id)).map((n) => n.id);
    }

    return AgentTopologySchema.parse({
      id,
      name,
      format: 'langgraph',
      nodes,
      edges,
      entry,
      exit,
      tools,
      ...(typeof obj.recursion_limit === 'number'
        ? { recursionLimit: obj.recursion_limit }
        : {}),
    });
  },
};

// ---------- CrewAI ----------

export const CrewAIImporter: TopologyImporter = {
  format: 'crewai',
  parse(input: unknown): AgentTopology {
    if (typeof input !== 'object' || input === null) {
      throw new Error('CrewAI topology must be an object');
    }
    const obj = input as Record<string, unknown>;
    const id = typeof obj.id === 'string' ? obj.id : `crewai-${Date.now()}`;
    const name = typeof obj.name === 'string' ? obj.name : 'crewai-crew';

    const rawAgents = (obj.agents as Array<Record<string, unknown>>) ?? [];
    const rawTasks = (obj.tasks as Array<Record<string, unknown>>) ?? [];
    const rawTools = (obj.tools as Array<Record<string, unknown>>) ?? [];
    const process =
      typeof obj.process === 'string' ? obj.process : 'sequential';

    const nodes: TopologyNode[] = rawAgents.map((a) => ({
      id: String(a.id ?? a.role ?? a.name),
      kind: 'agent',
      name: String(a.role ?? a.name ?? a.id),
      role: typeof a.role === 'string' ? a.role : undefined,
      isHitlGate: false,
      metadata: { goal: a.goal, backstory: a.backstory },
    }));

    // Synthesise edges from task order.
    const edges: TopologyEdge[] = [];
    if (process === 'sequential') {
      for (let i = 0; i < rawTasks.length - 1; i++) {
        const from = String(rawTasks[i]?.agent ?? '');
        const to = String(rawTasks[i + 1]?.agent ?? '');
        if (from && to) edges.push({ from, to });
      }
    } else if (process === 'hierarchical') {
      // Manager as fan-out; first agent treated as manager.
      const manager = String(rawAgents[0]?.id ?? rawAgents[0]?.role ?? '');
      for (let i = 1; i < rawAgents.length; i++) {
        const worker = String(
          rawAgents[i]?.id ?? rawAgents[i]?.role ?? '',
        );
        if (manager && worker) {
          edges.push({ from: manager, to: worker });
          edges.push({ from: worker, to: manager });
        }
      }
    }

    const tools: AgentTool[] = rawTools.map((t) => {
      const toolName = String(t.name ?? t.id);
      return {
        id: String(t.id ?? t.name),
        name: toolName,
        sensitivity:
          (t.sensitivity as ToolSensitivity | undefined) ??
          classifySensitivityHeuristic(toolName),
        schema: { params: [] },
        declaredAcl: Array.isArray(t.allowed_agents)
          ? (t.allowed_agents as string[]).map(String)
          : [],
        description:
          typeof t.description === 'string' ? t.description : undefined,
      };
    });

    const entry: string[] =
      rawTasks.length > 0 && typeof rawTasks[0]?.agent === 'string'
        ? [String(rawTasks[0].agent)]
        : nodes.length > 0
          ? [nodes[0]?.id ?? '']
          : [];

    return AgentTopologySchema.parse({
      id,
      name,
      format: 'crewai',
      nodes,
      edges,
      entry: entry.filter((s) => s.length > 0),
      exit: [],
      tools,
      ...(typeof obj.max_iterations === 'number'
        ? { recursionLimit: obj.max_iterations }
        : {}),
    });
  },
};

// ---------- AutoGen ----------

export const AutoGenImporter: TopologyImporter = {
  format: 'autogen',
  parse(input: unknown): AgentTopology {
    if (typeof input !== 'object' || input === null) {
      throw new Error('AutoGen topology must be an object');
    }
    const obj = input as Record<string, unknown>;
    const id = typeof obj.id === 'string' ? obj.id : `autogen-${Date.now()}`;
    const name = typeof obj.name === 'string' ? obj.name : 'autogen-group';

    const rawAgents = (obj.agents as Array<Record<string, unknown>>) ?? [];
    const rawTools = (obj.tools as Array<Record<string, unknown>>) ?? [];
    const groupChat = typeof obj.group_chat === 'object' && obj.group_chat
      ? (obj.group_chat as Record<string, unknown>)
      : null;
    const managerName =
      groupChat && typeof groupChat.manager === 'string'
        ? groupChat.manager
        : (rawAgents[0]?.name as string | undefined);

    const nodes: TopologyNode[] = rawAgents.map((a) => {
      const agentName = String(a.name ?? a.id);
      return {
        id: agentName,
        kind: 'agent',
        name: agentName,
        role: typeof a.role === 'string' ? a.role : agentName,
        isHitlGate:
          a.human_input_mode === 'ALWAYS' || a.human_input_mode === 'TERMINATE',
        metadata: { llm_config: a.llm_config },
      };
    });

    const edges: TopologyEdge[] = [];
    if (managerName && rawAgents.length > 1) {
      for (const a of rawAgents) {
        const an = String(a.name ?? a.id);
        if (an !== managerName) {
          edges.push({ from: managerName, to: an });
          edges.push({ from: an, to: managerName });
        }
      }
    }

    const tools: AgentTool[] = rawTools.map((t) => {
      const toolName = String(t.name ?? t.id);
      return {
        id: String(t.id ?? t.name),
        name: toolName,
        sensitivity:
          (t.sensitivity as ToolSensitivity | undefined) ??
          classifySensitivityHeuristic(toolName),
        schema: { params: [] },
        declaredAcl: Array.isArray(t.callers)
          ? (t.callers as string[]).map(String)
          : [],
        description:
          typeof t.description === 'string' ? t.description : undefined,
      };
    });

    const recursionLimit =
      groupChat && typeof groupChat.max_round === 'number'
        ? groupChat.max_round
        : undefined;

    return AgentTopologySchema.parse({
      id,
      name,
      format: 'autogen',
      nodes,
      edges,
      entry: managerName ? [managerName] : [],
      exit: [],
      tools,
      ...(recursionLimit !== undefined ? { recursionLimit } : {}),
    });
  },
};

// ---------- Custom JSON ----------

export const CustomJsonImporter: TopologyImporter = {
  format: 'custom-json',
  parse(input: unknown): AgentTopology {
    // Custom JSON is expected to already match the schema (or close to it).
    return AgentTopologySchema.parse(input);
  },
};

export const ALL_TOPOLOGY_IMPORTERS: readonly TopologyImporter[] = [
  LangGraphImporter,
  CrewAIImporter,
  AutoGenImporter,
  CustomJsonImporter,
];

export function importTopology(
  format: AgentTopology['format'],
  input: unknown,
): AgentTopology {
  const importer = ALL_TOPOLOGY_IMPORTERS.find((i) => i.format === format);
  if (!importer) throw new Error(`No topology importer for format: ${format}`);
  return importer.parse(input);
}

export { classifySensitivityHeuristic };
