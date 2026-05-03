// SPDX-License-Identifier: BUSL-1.1
//
// Agent topology domain model.
//
// AuditForge models an agentic system as a directed graph of agents and
// tools, with explicit entry / exit nodes and a recursion bound. Importers
// (LangGraph, CrewAI, AutoGen, custom JSON) normalise vendor formats into
// this shape so downstream analysis is vendor-agnostic.

import { z } from 'zod';

/** Distinct origin formats for an imported topology. */
export const TopologyFormat = z.enum([
  'langgraph',
  'crewai',
  'autogen',
  'custom-json',
]);
export type TopologyFormat = z.infer<typeof TopologyFormat>;

/** Sensitivity classification for a tool. */
export const ToolSensitivity = z.enum(['read', 'write', 'destructive']);
export type ToolSensitivity = z.infer<typeof ToolSensitivity>;

/** Parameter / return schema descriptor. JSON-Schema-like, intentionally loose. */
export const ToolParamSchema = z.object({
  name: z.string(),
  type: z.string(),
  description: z.string().optional(),
  required: z.boolean().default(false),
});
export type ToolParamSchema = z.infer<typeof ToolParamSchema>;

export const AgentToolSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  sensitivity: ToolSensitivity,
  schema: z.object({
    params: z.array(ToolParamSchema).default([]),
    returnType: z.string().optional(),
  }),
  declaredAcl: z.array(z.string()).default([]),
  description: z.string().optional(),
});
export type AgentTool = z.infer<typeof AgentToolSchema>;

/** Topology node. Either an agent (LLM-driven) or a tool reference. */
export const TopologyNodeKind = z.enum(['agent', 'tool', 'router', 'gate']);
export type TopologyNodeKind = z.infer<typeof TopologyNodeKind>;

export const TopologyNodeSchema = z.object({
  id: z.string().min(1),
  kind: TopologyNodeKind,
  name: z.string().min(1),
  /** For tool nodes, references AgentTool.id */
  toolId: z.string().optional(),
  /** Agent role label, used by ACL checks. */
  role: z.string().optional(),
  /** True if this node is a Human-in-the-Loop approval gate. */
  isHitlGate: z.boolean().default(false),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type TopologyNode = z.infer<typeof TopologyNodeSchema>;

/** Directed edge in the topology graph. */
export const TopologyEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  /** Optional condition label for conditional edges. */
  condition: z.string().optional(),
});
export type TopologyEdge = z.infer<typeof TopologyEdgeSchema>;

export const AgentTopologySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  format: TopologyFormat,
  nodes: z.array(TopologyNodeSchema).min(1),
  edges: z.array(TopologyEdgeSchema).default([]),
  /** Entry node id(s). At least one required. */
  entry: z.array(z.string()).min(1),
  /** Terminal node id(s). May be empty for graphs with implicit termination. */
  exit: z.array(z.string()).default([]),
  /** Tools available to this topology, keyed by id. */
  tools: z.array(AgentToolSchema).default([]),
  /** Hard recursion limit declared by the system designer. */
  recursionLimit: z.number().int().positive().optional(),
  /** Free-form notes captured at import. */
  notes: z.string().optional(),
});
export type AgentTopology = z.infer<typeof AgentTopologySchema>;

/** Autonomy levels per design 3.6. */
export const AutonomyLevel = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
]);
export type AutonomyLevel = z.infer<typeof AutonomyLevel>;

export const AutonomyLevelLabel: Record<1 | 2 | 3 | 4, string> = {
  1: 'suggest',
  2: 'execute-with-approval',
  3: 'execute-with-audit',
  4: 'execute-autonomous',
};
