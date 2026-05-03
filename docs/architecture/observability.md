<!-- SPDX-License-Identifier: BUSL-1.1 -->
# AuditForge ISO 42001 — Observability Architecture

This document defines the AuditForge observability stack, the four advertised SLOs and their
SLIs, error-budget mechanics, and the alert routing topology operators rely on at 03:00.

It is the canonical reference for production-grade SLO claims. If a metric, alert, or runbook
contradicts this document, this document wins until amended.

## 1. Stack overview

```
+--------------------+   OTLP   +--------------------+   remote_write   +-----------+
| apps/api worker    | -------> | OTel Collector     | ---------------> | Mimir/Prom |
| apps/web (RUM)     |          |  (tail sampling,   |                  +-----------+
| apps/mcp-server    |          |   PII strip)       |   OTLP traces    +-----------+
+--------------------+          +--------------------+ ---------------> | Tempo      |
                                          |          \  Loki push       +-----------+
                                          v           \                 +-----------+
                                  Loki / Grafana       +--------------> | Loki      |
                                                                        +-----------+
                                          ^
                                          |
                                  PrometheusRule
                                          |
                                          v
                                Alertmanager -> PagerDuty / Slack
```

- **Instrumentation**: every Node service initialises OTel via `@auditforge/observability`'s
  `initOtel()` exactly once at process start. The init is idempotent and supports `http` or `grpc`
  OTLP transports. Auto-instrumentations cover HTTP servers, Postgres, Redis, and BullMQ producers
  and consumers. Manual spans are added at SLO-critical sites with `withCriticalSpan`.
- **Logging**: pino is configured by `createLogger()` with a trace-id mixin and a strict redact list
  (headers, bodies, prompts, completions, signatures, JWTs, presigned URLs). Logs are JSON to stdout
  and shipped via the OTel collector's Loki exporter.
- **Metrics**: every service exposes a `prom-client` registry on `/metrics`. The canonical 19 named
  series are declared in `@auditforge/observability/metrics`. ServiceMonitor resources defined in
  `infra/helm/auditforge/templates/servicemonitor.yaml` route scraping to kube-prometheus-stack.
- **Tracing**: spans flow OTLP -> collector -> Tempo. The collector applies a tail-sampling policy
  that retains 100% of spans flagged `auditforge.critical=true` (ledger emit, RLS context, probe
  execution, LLM call) and 100% of error spans, plus a probabilistic 10% sample of the long tail.

## 2. SLIs and SLOs

| SLO | Target | SLI numerator | SLI denominator | Measurement window |
|-----|--------|---------------|-----------------|--------------------|
| API availability | 99.9% | `auditforge_http_request_duration_ms_count{status=~"5.."}` | `auditforge_http_request_duration_ms_count` | rolling 30 days |
| API latency | p95 < 200ms | `auditforge_http_request_duration_ms_bucket` (le=200) | `auditforge_http_request_duration_ms_count` | rolling 5 minutes |
| Audit-ledger durability | 99.999% | `auditforge_ledger_emit_failures_total` | `auditforge_ledger_emit_total` | rolling 30 days |
| Signing pipeline | 99.9% | `auditforge_signature_renewal_failure_total` | `auditforge_signature_renewal_success_total + auditforge_signature_renewal_failure_total` | rolling 30 days |
| Probe-runner availability | 99% | `auditforge_probe_duration_ms_count{status="error"}` | `auditforge_probe_duration_ms_count` | rolling 30 days |

All five SLIs are emitted from the AuditForge codebase (no third-party metric required) so the SLO
arithmetic does not depend on cluster/cloud-vendor exporters.

## 3. Error budgets and burn-rate alerting

Error budgets are computed continuously from the ratios above. We follow the Google SRE workbook's
multi-window multi-burn-rate alerting pattern. For each SLO we emit a fast-burn page (5m + 1h
windows, 14.4x burn) and a slow-burn ticket (30m + 6h windows, 6x burn). Recording rules under
`infra/helm/auditforge/templates/prometheusrule.yaml` define `auditforge:<slo>_burn_rate:<window>`
series so dashboards reuse the same arithmetic.

Concrete page rules (paged via PagerDuty):

| Alert | Trigger |
|-------|---------|
| `AuditForgeApiErrorBudgetBurnFast` | API burn 5m & 1h > 14.4 for 2m |
| `AuditForgeApiErrorBudgetBurnSlow` | API burn 30m & 6h > 6 for 15m |
| `AuditForgeLedgerErrorBudgetBurnFast` | Ledger burn 5m & 1h > 14.4 for 2m |
| `AuditForgeLedgerErrorBudgetBurnSlow` | Ledger burn 1h & 6h > 6 for 15m |
| `AuditForgeSigningErrorBudgetBurnFast` | Signing burn 5m & 1h > 14.4 for 2m |
| `AuditForgeProbeErrorBudgetBurnFast` | Probe burn 5m & 1h > 14.4 for 2m |
| `ChainVerifyFailureSpike` | any chain-verify failure in 10m |
| `SignatureRenewalFailed` | any signature renewal failure in 1h |
| `MissedArchiveRenewal` | archive-renewal CronJob > 26h since last completion |
| `BackupTooOld` | backup age > 25h |
| `AVScanDisabled` | AV heartbeat < 1 for 5m |
| `RLSBypassDetected` | any rls bypass counter increment in 5m |
| `ProbeRunnerBacklog` | probe queue depth > 250 for 15m |
| `LLMRoutingFallback` | any fallback in 10m |
| `ProbeBudgetBreached` | probe budget used > 50 USD per engagement |

Warning-tier alerts (Slack #auditforge-ops):

- `AuditForgeApiP95LatencyHigh`
- `LedgerBacklogGrowing`
- `LLMCostHighPerEngagement`
- `ProbeBudget80Pct`

## 4. Alert routing

| Severity | Channel | Receiver |
|---------|---------|----------|
| `critical` + `page=true` | PagerDuty service `auditforge-prod` | on-call SRE primary |
| `critical` (no `page` label) | Slack `#auditforge-incidents` | secondary, ack within 15m |
| `warning` | Slack `#auditforge-ops` | business hours triage |
| `info` | Grafana annotation only | none |

PagerDuty escalation policy: primary -> secondary after 10m unacked -> CISO after 30m unacked for
any alert with `slo` in `[ledger-durability, ledger-integrity, tenant-isolation, evidence-integrity]`.

## 5. Tenant isolation

Per-tenant labels are NEVER raw tenant ids. The `firm_id_hashed` and `engagement_hashed` labels are
xxhash-mod-64 buckets; the bucket count is documented in `@auditforge/observability/metrics` and
must remain stable across releases. Per-tenant drill-down uses the audit ledger and Loki log
pipeline (which retain raw ids under access control), not Prometheus.

## 6. Observability data retention

| Backend | Default retention | Rationale |
|---------|--------------------|-----------|
| Prometheus / Mimir | 30d hot, 1y cold | matches monthly error-budget windows |
| Tempo | 14d | trace store sized for incident debugging, not forensic audit |
| Loki | 30d | application logs + structured request logs |
| Audit ledger (Postgres) | retention class per ISO 42001 record schedule | source-of-truth for compliance |

The audit ledger is the system of record for compliance. Telemetry is best-effort.

## 7. Privacy defaults

- Spans never carry raw prompt, completion, or evidence content. Where a hash is needed, callers
  use `auditforge.llm.prompt_hash` etc.
- HTTP attributes are scrubbed by the collector's `attributes/pii_strip` processor (drops query
  strings, replaces UUIDs in paths with `:id`, hashes `db.statement` parameter values).
- Pino redaction is defense-in-depth: explicit allow-list paths plus default match against
  `password|secret|token|key|signature|jwt|bearer`.

## 8. Owner / on-call

Observability stack is co-owned by Platform SRE (alert plumbing, collector) and the Audit Engine
team (ledger metrics, chain-verify alerts). Schema changes to the canonical metric set require an
ADR and a cross-team review.
