// SPDX-License-Identifier: BUSL-1.1
//
// TraceAnalyzer: pure functions over a normalised AgentTrace.
//
// All outputs are Zod-validated TraceAnalysisReports so they can flow into
// working papers and findings without further conversion. Anomaly thresholds
// are configurable but have sensible defaults derived from common LLM agent
// production patterns.

import type { AgentTrace } from '../types/trace.js';
import {
  TraceAnalysisReportSchema,
  type Anomaly,
  type CostRollup,
  type DecisionPathStep,
  type LatencyPercentiles,
  type TimelineEntry,
  type TraceAnalysisReport,
} from '../reports/index.js';
import { summarisePercentiles } from '../util/percentiles.js';

export interface AnomalyThresholds {
  /** A span whose latency exceeds (median * factor) is a spike. */
  latencySpikeFactor: number;
  /** Tool calls to the same toolId greater than this count are a "loop" hint. */
  repeatedToolCallThreshold: number;
  /** Prompt token count above which we flag oversized prompts. */
  oversizedPromptTokens: number;
  /** Errors per span; if exceeded across the trace, "error burst". */
  errorBurstRate: number;
}

export const DEFAULT_THRESHOLDS: AnomalyThresholds = {
  latencySpikeFactor: 5,
  repeatedToolCallThreshold: 10,
  oversizedPromptTokens: 50_000,
  errorBurstRate: 0.1,
};

export class TraceAnalyzer {
  constructor(
    private readonly thresholds: AnomalyThresholds = DEFAULT_THRESHOLDS,
  ) {}

  buildTimeline(trace: AgentTrace): TimelineEntry[] {
    if (trace.spans.length === 0) return [];
    const minStartNs = trace.spans.reduce(
      (m, s) => Math.min(m, s.startNs),
      Number.POSITIVE_INFINITY,
    );
    const out: TimelineEntry[] = trace.spans.map((s) => {
      const startMs = (s.startNs - minStartNs) / 1_000_000;
      const endMs = (s.endNs - minStartNs) / 1_000_000;
      const entry: TimelineEntry = {
        spanId: s.spanId,
        ...(s.parentSpanId ? { parentSpanId: s.parentSpanId } : {}),
        name: s.name,
        kind: s.kind,
        startMs: Math.max(0, startMs),
        endMs: Math.max(0, endMs),
        durationMs: Math.max(0, endMs - startMs),
        status: s.status,
        ...(s.agentRole ? { agentRole: s.agentRole } : {}),
      };
      return entry;
    });
    out.sort((a, b) => a.startMs - b.startMs);
    return out;
  }

  costRollup(trace: AgentTrace): CostRollup {
    const perModel: Record<string, number> = {};
    let totalPrompt = 0;
    let totalCompletion = 0;
    let totalCost = 0;
    let cacheHits = 0;
    for (const c of trace.llmCalls) {
      perModel[c.model] = (perModel[c.model] ?? 0) + c.costUsd;
      totalPrompt += c.promptTokens;
      totalCompletion += c.completionTokens;
      totalCost += c.costUsd;
      if (c.cacheHit) cacheHits += 1;
    }
    const cacheHitRate =
      trace.llmCalls.length === 0 ? 0 : cacheHits / trace.llmCalls.length;
    return {
      totalUsd: totalCost,
      perModel,
      totalPromptTokens: totalPrompt,
      totalCompletionTokens: totalCompletion,
      cacheHitRate,
    };
  }

  latency(trace: AgentTrace): LatencyPercentiles {
    const durations = trace.spans.map((s) => (s.endNs - s.startNs) / 1_000_000);
    return summarisePercentiles(durations);
  }

  errorRate(trace: AgentTrace): { rate: number; count: number } {
    if (trace.spans.length === 0) return { rate: 0, count: 0 };
    const count = trace.spans.filter((s) => s.status === 'error').length;
    return { rate: count / trace.spans.length, count };
  }

  decisionPath(trace: AgentTrace): DecisionPathStep[] {
    return trace.decisions.map((d) => ({
      spanId: d.spanId,
      branch: d.branch,
      ...(d.reason ? { reason: d.reason } : {}),
      rejection: d.rejection,
    }));
  }

  detectAnomalies(trace: AgentTrace): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const durations = trace.spans.map((s) => (s.endNs - s.startNs) / 1_000_000);
    if (durations.length > 0) {
      const sorted = [...durations].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
      const cutoff = Math.max(50, median * this.thresholds.latencySpikeFactor);
      for (const s of trace.spans) {
        const ms = (s.endNs - s.startNs) / 1_000_000;
        if (ms > cutoff && median > 0) {
          anomalies.push({
            kind: 'latency-spike',
            spanId: s.spanId,
            detail: `Span "${s.name}" took ${ms.toFixed(1)} ms (median ${median.toFixed(1)} ms)`,
            severity: ms > cutoff * 2 ? 'high' : 'medium',
          });
        }
      }
    }

    // Repeated tool calls (loop hint)
    const counts = new Map<string, number>();
    for (const tc of trace.toolCalls) {
      counts.set(tc.toolId, (counts.get(tc.toolId) ?? 0) + 1);
    }
    for (const [toolId, n] of counts.entries()) {
      if (n >= this.thresholds.repeatedToolCallThreshold) {
        anomalies.push({
          kind: 'repeated-tool-call',
          toolId,
          detail: `Tool "${toolId}" invoked ${n} times — possible loop`,
          severity: n >= this.thresholds.repeatedToolCallThreshold * 2 ? 'high' : 'medium',
        });
      }
    }

    // Oversized prompt
    for (const c of trace.llmCalls) {
      if (c.promptTokens > this.thresholds.oversizedPromptTokens) {
        anomalies.push({
          kind: 'oversized-prompt',
          spanId: c.spanId,
          detail: `LLM call to ${c.model} used ${c.promptTokens} prompt tokens`,
          severity: 'medium',
        });
      }
    }

    // Error burst
    if (trace.spans.length > 0) {
      const rate = trace.errors.length / trace.spans.length;
      if (rate > this.thresholds.errorBurstRate) {
        anomalies.push({
          kind: 'unexpected-error-burst',
          detail: `${trace.errors.length} errors over ${trace.spans.length} spans (${(rate * 100).toFixed(1)}%)`,
          severity: rate > 0.25 ? 'high' : 'medium',
        });
      }
    }

    return anomalies;
  }

  analyse(trace: AgentTrace): TraceAnalysisReport {
    const { rate, count } = this.errorRate(trace);
    const report: TraceAnalysisReport = {
      traceId: trace.id,
      engagementId: trace.engagementId,
      timeline: this.buildTimeline(trace),
      costRollup: this.costRollup(trace),
      latency: this.latency(trace),
      errorRate: rate,
      errorCount: count,
      escalationCount: trace.escalations.length,
      decisionPath: this.decisionPath(trace),
      anomalies: this.detectAnomalies(trace),
      spanCount: trace.spans.length,
      toolCallCount: trace.toolCalls.length,
      llmCallCount: trace.llmCalls.length,
    };
    return TraceAnalysisReportSchema.parse(report);
  }
}
