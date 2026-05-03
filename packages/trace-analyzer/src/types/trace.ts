// SPDX-License-Identifier: BUSL-1.1
//
// Trace domain model. Vendor-agnostic representation of an agent run produced
// by the trace importers. Time fields use nanosecond integers (matches OTel)
// so that high-volume traces don't lose precision when re-serialised.

import { z } from 'zod';

export const TraceFormat = z.enum(['otel', 'langfuse', 'phoenix', 'custom']);
export type TraceFormat = z.infer<typeof TraceFormat>;

export const SpanKind = z.enum([
  'agent',
  'llm',
  'tool',
  'router',
  'gate',
  'internal',
  'unknown',
]);
export type SpanKind = z.infer<typeof SpanKind>;

export const SpanStatus = z.enum(['ok', 'error', 'unset']);
export type SpanStatus = z.infer<typeof SpanStatus>;

export const SpanEventSchema = z.object({
  name: z.string(),
  /** Event timestamp, ns since epoch. */
  timeNs: z.number().int().nonnegative(),
  attributes: z.record(z.string(), z.unknown()).default({}),
});
export type SpanEvent = z.infer<typeof SpanEventSchema>;

export const TraceSpanSchema = z.object({
  spanId: z.string().min(1),
  parentSpanId: z.string().optional(),
  name: z.string().min(1),
  kind: SpanKind,
  /** Span start, ns since epoch. */
  startNs: z.number().int().nonnegative(),
  /** Span end, ns since epoch. Always >= startNs. */
  endNs: z.number().int().nonnegative(),
  attributes: z.record(z.string(), z.unknown()).default({}),
  status: SpanStatus,
  events: z.array(SpanEventSchema).default([]),
  /** Owning agent role (e.g. "planner", "researcher"); set by importers when known. */
  agentRole: z.string().optional(),
});
export type TraceSpan = z.infer<typeof TraceSpanSchema>;

export const LlmCallSchema = z.object({
  spanId: z.string(),
  model: z.string(),
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  latencyMs: z.number().nonnegative(),
  costUsd: z.number().nonnegative(),
  cacheHit: z.boolean().default(false),
});
export type LlmCall = z.infer<typeof LlmCallSchema>;

export const ToolCallSchema = z.object({
  spanId: z.string(),
  /** References AgentTool.id. */
  toolId: z.string(),
  /** Agent role that invoked the tool, when known from span attributes. */
  invokedBy: z.string().optional(),
  params: z.unknown().optional(),
  result: z.unknown().optional(),
  errored: z.boolean().default(false),
  latencyMs: z.number().nonnegative().default(0),
});
export type ToolCall = z.infer<typeof ToolCallSchema>;

export const DecisionSchema = z.object({
  spanId: z.string(),
  /** Branch chosen by the agent (edge label or node id). */
  branch: z.string(),
  /** Auditor-readable reason if recoverable from prompt/output. */
  reason: z.string().optional(),
  /** True when the agent rejected available branches and produced fallback. */
  rejection: z.boolean().default(false),
});
export type Decision = z.infer<typeof DecisionSchema>;

export const TraceErrorSchema = z.object({
  spanId: z.string(),
  message: z.string(),
  type: z.string().optional(),
});
export type TraceError = z.infer<typeof TraceErrorSchema>;

export const EscalationSchema = z.object({
  spanId: z.string(),
  /** "human-approval", "supervisor", "external-system", etc. */
  target: z.string(),
  approved: z.boolean().optional(),
});
export type Escalation = z.infer<typeof EscalationSchema>;

export const AgentTraceSchema = z.object({
  id: z.string().min(1),
  engagementId: z.string().min(1),
  traceFormat: TraceFormat,
  spans: z.array(TraceSpanSchema),
  llmCalls: z.array(LlmCallSchema).default([]),
  toolCalls: z.array(ToolCallSchema).default([]),
  decisions: z.array(DecisionSchema).default([]),
  errors: z.array(TraceErrorSchema).default([]),
  escalations: z.array(EscalationSchema).default([]),
  totalLatencyMs: z.number().nonnegative(),
  totalCostUsd: z.number().nonnegative(),
  ingestedAt: z.string().datetime(),
});
export type AgentTrace = z.infer<typeof AgentTraceSchema>;
