// SPDX-License-Identifier: BUSL-1.1
//
// Output report schemas. These are the public contracts consumed by
// @auditforge/audit-engine (working papers) and the finding manager.

import { z } from 'zod';
import { AutonomyLevel } from '../types/topology.js';

/** A timeline entry suitable for Gantt-style rendering. */
export const TimelineEntrySchema = z.object({
  spanId: z.string(),
  parentSpanId: z.string().optional(),
  name: z.string(),
  kind: z.string(),
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
  durationMs: z.number().nonnegative(),
  status: z.string(),
  agentRole: z.string().optional(),
});
export type TimelineEntry = z.infer<typeof TimelineEntrySchema>;

export const LatencyPercentilesSchema = z.object({
  p50Ms: z.number().nonnegative(),
  p90Ms: z.number().nonnegative(),
  p95Ms: z.number().nonnegative(),
  p99Ms: z.number().nonnegative(),
  maxMs: z.number().nonnegative(),
});
export type LatencyPercentiles = z.infer<typeof LatencyPercentilesSchema>;

export const CostRollupSchema = z.object({
  totalUsd: z.number().nonnegative(),
  perModel: z.record(z.string(), z.number().nonnegative()),
  totalPromptTokens: z.number().int().nonnegative(),
  totalCompletionTokens: z.number().int().nonnegative(),
  cacheHitRate: z.number().min(0).max(1),
});
export type CostRollup = z.infer<typeof CostRollupSchema>;

export const AnomalySchema = z.object({
  kind: z.enum([
    'latency-spike',
    'repeated-tool-call',
    'oversized-prompt',
    'unbounded-loop',
    'unexpected-error-burst',
  ]),
  spanId: z.string().optional(),
  toolId: z.string().optional(),
  detail: z.string(),
  severity: z.enum(['info', 'low', 'medium', 'high']),
});
export type Anomaly = z.infer<typeof AnomalySchema>;

export const DecisionPathStepSchema = z.object({
  spanId: z.string(),
  branch: z.string(),
  reason: z.string().optional(),
  rejection: z.boolean(),
});
export type DecisionPathStep = z.infer<typeof DecisionPathStepSchema>;

export const TraceAnalysisReportSchema = z.object({
  traceId: z.string(),
  engagementId: z.string(),
  timeline: z.array(TimelineEntrySchema),
  costRollup: CostRollupSchema,
  latency: LatencyPercentilesSchema,
  errorRate: z.number().min(0).max(1),
  errorCount: z.number().int().nonnegative(),
  escalationCount: z.number().int().nonnegative(),
  decisionPath: z.array(DecisionPathStepSchema),
  anomalies: z.array(AnomalySchema),
  spanCount: z.number().int().nonnegative(),
  toolCallCount: z.number().int().nonnegative(),
  llmCallCount: z.number().int().nonnegative(),
});
export type TraceAnalysisReport = z.infer<typeof TraceAnalysisReportSchema>;

export const ToolAclDriftSchema = z.object({
  toolId: z.string(),
  toolName: z.string(),
  declaredAcl: z.array(z.string()),
  observedInvokers: z.array(z.string()),
  unauthorisedInvokers: z.array(z.string()),
  occurrences: z.number().int().nonnegative(),
  sensitivity: z.enum(['read', 'write', 'destructive']),
});
export type ToolAclDrift = z.infer<typeof ToolAclDriftSchema>;

export const ToolAclDriftReportSchema = z.object({
  topologyId: z.string(),
  totalTraces: z.number().int().nonnegative(),
  drifts: z.array(ToolAclDriftSchema),
  /** Tools that were declared but never observed in traces. */
  unusedTools: z.array(z.string()),
  /** Tools observed in traces but not declared in topology at all. */
  undeclaredTools: z.array(z.string()),
});
export type ToolAclDriftReport = z.infer<typeof ToolAclDriftReportSchema>;

export const HitlGateOutcomeSchema = z.object({
  gateId: z.string(),
  gateName: z.string(),
  totalEncounters: z.number().int().nonnegative(),
  approved: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
  /** Encounters where the gate was reached but no escalation/approval recorded. */
  skipped: z.number().int().nonnegative(),
  /** Trace ids where the gate was skipped. Auditor sample list. */
  skippedTraceIds: z.array(z.string()),
});
export type HitlGateOutcome = z.infer<typeof HitlGateOutcomeSchema>;

export const HitlGateAuditReportSchema = z.object({
  topologyId: z.string(),
  totalTraces: z.number().int().nonnegative(),
  gates: z.array(HitlGateOutcomeSchema),
  /** Overall conformity:  no gates skipped. */
  conformant: z.boolean(),
});
export type HitlGateAuditReport = z.infer<typeof HitlGateAuditReportSchema>;

export const AutonomyAssessmentSchema = z.object({
  level: AutonomyLevel,
  label: z.string(),
  rationale: z.string(),
  /** Signals that drove the classification. */
  signals: z.array(z.string()),
});
export type AutonomyAssessment = z.infer<typeof AutonomyAssessmentSchema>;

export const FailureSampleSchema = z.object({
  traceId: z.string(),
  reason: z.enum([
    'has-error',
    'has-escalation',
    'unexpected-path',
    'recursion-limit',
    'high-cost',
  ]),
  detail: z.string().optional(),
});
export type FailureSample = z.infer<typeof FailureSampleSchema>;
