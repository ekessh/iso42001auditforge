# @auditforge/trace-analyzer

AuditForge ISO 42001 — **Phase 6: Agentic Workflow Auditor** (BUSL-1.1).

This package implements Section 3.6 of the AuditForge design: deep, auditor-first
inspection of agentic AI workflows. It ingests agent **topologies** (LangGraph,
CrewAI, AutoGen, custom JSON), ingests **traces** (OpenTelemetry / Langfuse /
Phoenix / custom JSON), and produces structured analysis suitable for working
papers, findings, and the Technical Assessment Annex.

## Capabilities

- **Topology importers** — LangGraph state-graph JSON, CrewAI, AutoGen, custom JSON.
- **Trace ingestion** — OTel JSON (streaming, 100k+ spans), Langfuse export,
  Phoenix export, custom JSON. Idempotent on `traceId`.
- **Trace analysis** — timeline, cost rollup, latency percentiles, error rate,
  escalation count, decision-path summary, anomaly detection.
- **Tool registry review** — sensitivity classification, declared-vs-actual ACL
  drift, tool-permission graph (Graphviz DOT + JSON for UI).
- **Loop & recursion limit verifier** — detects unbounded recursion in topology
  and actual traces.
- **Human-in-loop gate verifier** — checks declared HITL gates against actual
  approvals/skips in traces.
- **Memory & state reviewer** — interface for persistent-memory growth, PII
  retention, cross-tenant leakage.
- **Failure mode sampler** — samples traces with errors, escalations, or
  unexpected paths for auditor review.
- **Multi-agent coordination reviewer** — orchestrator authority, worker
  isolation, message-protocol checks.
- **Autonomy classifier** — maps observed behavior to **levels 1–4** (suggest,
  execute-with-approval, execute-with-audit, execute-autonomous) with
  rationale.

## Output schemas

These Zod schemas are consumed by `@auditforge/audit-engine` (working papers)
and downstream finding manager:

- `TraceAnalysisReport`
- `ToolAclDriftReport`
- `HitlGateAuditReport`

## Streaming & performance

OTel imports use a streaming JSON parser (`stream-json`) so 100k-span traces
do not OOM. Internal data structures for the timeline use sorted arrays with
binary search rather than nested object trees.

**Benchmark target:** 100k spans, parse + analyze, < 5s on commodity hardware.

A synthetic 100k-span benchmark is included in `tests/perf.test.ts`. The test
asserts a generous upper bound (under 30s in CI containers) but logs actual
elapsed time so regressions are visible. On a typical developer laptop the
analysis path completes well under the 5s target.

## Layout

```
src/
  types/        Zod schemas for AgentTopology, AgentTrace, reports
  importers/    Topology + trace importers (LangGraph, CrewAI, AutoGen, OTel, Langfuse, Phoenix, custom)
  services/     ToolRegistryReviewer, TraceAnalyzer, LoopRecursionLimitVerifier,
                HumanInLoopGateVerifier, MemoryStateReviewer, FailureModeSampler,
                MultiAgentCoordinationReviewer, AutonomyClassifier
  reports/      Output report schemas (TraceAnalysisReport, ToolAclDriftReport, HitlGateAuditReport)
  util/         Streaming JSON parser, percentile helpers, dot-graph builder
tests/          50+ tests; golden fixtures for each importer; perf test for 100k spans
```

## License

Business Source License 1.1. See repo root `LICENSE`.
