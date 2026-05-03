# AuditForge ISO 42001 — Observability & Operability Review

**Scope:** Read-only review of OTel instrumentation, structured logging, metrics, dashboards, alerting, health checks, DR/backup, runbooks, audit-ledger correlation, LLM telemetry, conversational-engine telemetry, MCP-server telemetry, and privacy defaults.

**Stack target (per request):** OpenTelemetry → Tempo/Jaeger, Prometheus + Grafana, Loki, Sentry.

**SLO targets (per request):**
- API p95 < 200 ms
- Audit-ledger durability 99.999 %
- Signing pipeline 99.9 %
- Probe-runner availability 99 %

**Verdict (executive):** The repo has the *skeleton* of an observability story (OTel SDK init, Prom registry stub, ServiceMonitor/PrometheusRule templates, backup + archive-renewal CronJobs) but the *meat is missing*. Required custom metrics are referenced in alert PromQL but never emitted by any code; the shared `packages/observability` does not exist; Grafana dashboards directory is empty; no observability/DR/runbook docs exist; the helm health-probe path does not match the API route; and the Helm ConfigMap exports OTel env vars under a name (`AUDITFORGE_OTEL_*`) that the API config schema never reads, so OTel will silently no-op in cluster. **None of the 9 required dashboards are present.** Sentry is not integrated. Loki is not configured. There are zero manual OTel spans on the critical paths (ledger emit, RLS, probe execution, LLM call). The findings below are blockers for a production launch against the stated SLOs.

---

## Severity legend

- **CRITICAL** — Blocks production launch / SLO measurement / incident response.
- **HIGH** — Materially degrades operability; will cause silent SLO drift or unactionable alerts.
- **MEDIUM** — Real gap, can ship behind a flag with a written follow-up.
- **LOW / INFO** — Nice-to-have; documentation, polish, future work.

Each finding cites file paths (absolute) and line numbers where applicable.

---

## 1. OpenTelemetry instrumentation

### CRITICAL-OBS-001 — Helm ConfigMap exports OTel endpoint under a key the API never reads
**Files:** `c:/Users/ekess/Downloads/iso42001auditforge/infra/helm/auditforge/templates/configmap.yaml:13-14`, `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/config/config.schema.ts:36-37`, `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/main.ts:18`.

The ConfigMap sets `AUDITFORGE_OTEL_EXPORTER_OTLP_ENDPOINT` and `AUDITFORGE_OTEL_EXPORTER_OTLP_INSECURE`. The API reads `OTEL_EXPORTER_OTLP_ENDPOINT` (no `AUDITFORGE_` prefix). `startOtel()` is called with `cfg.OTEL_EXPORTER_OTLP_ENDPOINT`, which will be `undefined`, and `startOtel` short-circuits when the endpoint is empty (`apps/api/src/otel.ts:10` `if (!otlpEndpoint) return;`). Net effect: in every Helm-deployed environment, OTel never starts. There is no log line warning about this, so the regression is silent.

Recommendation: either rename ConfigMap keys to drop the `AUDITFORGE_` prefix and align with the standard OTLP env vars (`OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_PROTOCOL`, etc.) or change the config schema to accept the prefixed names. Add a startup `logger.warn` when `OTEL_EXPORTER_OTLP_ENDPOINT` is unset in `production`/`staging`.

### CRITICAL-OBS-002 — No manual spans on any critical path
**Search:** Grep for `trace.getTracer|trace.getActiveSpan|context.active|withSpan|startActiveSpan` across the entire repo returns **zero matches**.

The init in `apps/api/src/otel.ts` enables only `getNodeAutoInstrumentations`. That gives you HTTP server, fetch, pg, ioredis spans for free, but it does **not** give you spans on:

- Audit ledger emit (`packages/audit-engine/src/ledger.ts` `AuditLedger.emit`, `signWithTSA`, `verifyChain`).
- RLS context set (`apps/api/src/common/rls.middleware.ts` — never wraps a span around the AsyncLocalStorage run, so trace-to-tenant attribution from collector side is impossible without enrichment).
- Probe execution (`packages/probe-engine/src/runner.ts`, `apps/worker` — worker has no `main.ts` at all).
- LLM invocation (`packages/llm-cloud/src` is empty; `packages/llm-provider/src/{providers,routing,db,templates}` are empty).
- Audit-trail interceptor (`apps/api/src/common/audit-trail.interceptor.ts`).

Without these, distributed traces will end at the HTTP boundary and you cannot debug any of the four SLO-critical pipelines via Tempo/Jaeger. The 99.999 % ledger durability target is unauditable.

Recommendation: introduce `packages/observability` (see CRITICAL-OBS-003) exporting a `getTracer(scope)` helper plus typed span wrappers (`withLedgerSpan`, `withProbeSpan`, `withLlmSpan`) that set canonical attributes (`auditforge.tenant_id`, `auditforge.engagement_id`, `auditforge.request_id`, `auditforge.ledger.event_type`, `auditforge.ledger.sequence`, `auditforge.probe.id`, `auditforge.llm.provider`, `auditforge.llm.model`, `auditforge.llm.purpose`).

### CRITICAL-OBS-003 — `packages/observability` shared init does not exist
**Search:** `ls packages` shows no `observability` package. Every consumer that needs OTel/metrics rolls its own. The API has its own `apps/api/src/otel.ts`. The worker depends on `@opentelemetry/sdk-node` in `apps/worker/package.json:18-21` but has **no** `main.ts` or any consumer of those deps.

Recommendation: extract a `packages/observability` with:
- `initTelemetry({ serviceName, otlpEndpoint, sampler, resourceAttrs })` — single source of truth for SDK config (resource detection, sampler, exporter, shutdown).
- `getMeter()` / `getTracer()` thin wrappers.
- A `metrics` module that owns the canonical Prom registry and the custom histograms / counters listed in §3 below.
- A `logger` module (pino factory) wired to OTel context so log records carry `trace_id` / `span_id`.

### HIGH-OBS-004 — Worker has no entrypoint; OTel deps are dead code
**Files:** `c:/Users/ekess/Downloads/iso42001auditforge/apps/worker/package.json:8-9` declares `start: node dist/main.js`. `c:/Users/ekess/Downloads/iso42001auditforge/apps/worker/src/` contains `config/`, `sandbox/`, `schemas/` but `processors/` and `adapters/` are empty and **there is no `main.ts`**. The worker Helm Deployment will fail at runtime; OTel deps in `apps/worker/package.json` are therefore not exercised.

Recommendation: implement `apps/worker/src/main.ts` and at startup call the shared `initTelemetry` from `packages/observability`. Until that exists, the probe-runner availability SLO of 99 % cannot be measured at all.

### HIGH-OBS-005 — Auto-instrumentation exporter is HTTP, not gRPC; no sampler is configured
**Files:** `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/otel.ts:3,11-19`.

The SDK uses `OTLPTraceExporter` from `exporter-trace-otlp-http`, hard-codes `${otlpEndpoint}/v1/traces`, never sets a sampler (defaults to `ParentBased(AlwaysOn)`), never sets resource attributes (no `service.version`, no `deployment.environment`, no `auditforge.component`), and disables only the `fs` instrumentation. `dns` and `net` are also high-noise; you will want to disable those for cost. There is no metrics SDK init at all (only traces) — Prom scrape is fine for now, but you will need OTel metrics if you ever push metrics through the collector.

Recommendation: configure `ParentBased(TraceIdRatio(env.OTEL_TRACES_SAMPLER_ARG))`, set `Resource` with `service.name`, `service.version` (from package.json), `deployment.environment`, `auditforge.component`, `auditforge.tenant_id` (per-request via SpanProcessor enricher). Per-tenant sampling override should be supported (CRITICAL-OBS-024). Move endpoint composition to the collector — point at `/` not `/v1/traces`, and let the SDK append.

### MEDIUM-OBS-006 — No graceful shutdown for OTel from Nest lifecycle
**File:** `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/otel.ts:20-21`. The shutdown hook listens on `SIGTERM` directly. NestJS already calls `enableShutdownHooks()` (`apps/api/src/main.ts:64`); double-listening is harmless but the OTel shutdown is not awaited before Nest exits, which can drop in-flight spans / batch exports during rolling deploys.

Recommendation: wire OTel shutdown into a Nest `onApplicationShutdown` hook so it runs during the documented graceful window.

---

## 2. Structured logging

### HIGH-OBS-007 — Logger is not correlated with OTel trace context
**File:** `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/app.module.ts:56-62`.

`LoggerModule.forRoot` configures pino with a small redact list and `autoLogging: true` but does **not** install a pino mixin / formatter that pulls `trace_id` / `span_id` from `@opentelemetry/api` context. As a result, log → trace correlation in Loki/Grafana via `traceID` will not work; operators cannot pivot from a Loki line to a Tempo trace. This breaks the explicit ask in finding 9 (audit-ledger correlation: request-id ↔ ledger-event-id ↔ trace-id).

Recommendation: add a pino `mixin` that calls `trace.getActiveSpan()?.spanContext()` and emits `trace_id`, `span_id`, `trace_flags`. Also surface `request_id` and `firm_id` (from `RequestContextStore`) on every line. Configure Loki Grafana datasource `derivedFields` for `trace_id`.

### HIGH-OBS-008 — Pino redaction list is incomplete
**File:** `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/app.module.ts:60`.

Only `req.headers.authorization`, `req.headers.cookie`, and `req.headers["x-webauthn-attestation"]` are redacted. There is no redaction of:

- Request bodies for endpoints that accept PII (interview transcripts, evidence file paths, working-paper content, claims about identifiable individuals — see `packages/conversational-engine/src/types/domain.ts`).
- Response bodies (autoLogging includes res.body summaries depending on Fastify version).
- LLM prompts/completions (none redacted because no logger touches them yet, but a known foot-gun once §10 is implemented).
- TSA tokens and signatures (`packages/audit-engine/src/tsa.ts`, `packages/report-engine/src/signing/`).
- JWT tokens, cookies, idempotency keys, S3 presigned URLs.

Recommendation: replace the small `redact` array with a deny-list of explicit body paths plus a default redactor that drops anything matching `/(?:secret|password|token|key|signature|jwt|bearer)/i`. Disable `autoLogging` in production and emit explicit `req.complete` events that go through the redactor.

### MEDIUM-OBS-009 — No log shipper / Loki integration
**Search:** `loki|fluent|fluent-bit|promtail` returns no hits in `infra/`. The Helm chart has no Promtail/Vector/Fluent-Bit DaemonSet or sidecar; logs are written to stdout and lost outside the pod log retention window.

Recommendation: add a `loki` (or `vector`) DaemonSet template gated by `Values.loki.enabled`, or document an external "BYO log pipeline" expectation. Either way, ship something.

### LOW-OBS-010 — `console.{debug,info,warn,error}` in `apps/mcp-server/src/audit.ts:206-210`
The fallback `consoleLogger` writes JSON lines but bypasses pino redaction. Acceptable for dev; document that production must inject the structured logger from the API host process.

---

## 3. Metrics

### CRITICAL-OBS-011 — Required custom metrics are not emitted anywhere
**File:** `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/common/metrics.ts:1-28`.

The metrics module declares only three custom series: `auditforge_http_requests_total`, `auditforge_http_request_duration_ms`, and `auditforge_ledger_events_total`. Even those are **not incremented anywhere** in the codebase — `Grep "httpRequests|httpLatencyMs|ledgerEvents"` returns hits only in `metrics.ts` itself and the `/metrics` endpoint that exposes the registry. Net effect: the only metrics Prometheus will scrape are the default Node runtime metrics (`process_*`, `nodejs_*`).

The PromQL in `infra/helm/auditforge/templates/prometheusrule.yaml` references series that do not exist anywhere in the codebase:

| Alert | Metric referenced | Defined? |
|------|-------------------|----------|
| `AuditForgeApiHighErrorRate*Burn` | `http_requests_total{status=~"5.."}` | **No.** The custom series is `auditforge_http_requests_total` and is never incremented. |
| `AuditForgeApiP95LatencyHigh` | `http_server_duration_seconds_bucket` | **No.** No OTel metric exporter is installed. |
| `AuditForgeLedgerChainVerifyFailure` | `auditforge_ledger_chain_verify_failures_total` | **No.** No counter exists. |
| `AuditForgeLedgerBacklogGrowing` | `auditforge_ledger_pending_events` | **No.** No gauge exists. |
| `AuditForgeAVScanDisabled` | `auditforge_av_scan_enabled` | **No.** No gauge exists. |
| `AuditForgeRLSBypassDetected` | `auditforge_rls_bypass_total` | **No.** No counter exists. |
| `AuditForgeProbeBudget*` | `auditforge_probe_budget_used`, `auditforge_probe_budget_total` | **No.** No gauges exist. |
| `AuditForgeHighLLMCost` | `auditforge_llm_cost_usd_total` | **No.** No counter exists. |

Every single PrometheusRule will evaluate against missing series, which means the alerts will either never fire or — worse — fire as `NoData` depending on Alertmanager config. The 99.999 % ledger durability claim is currently unprovable in production.

Required new metrics (per the review brief), with suggested types and labels:

| Metric | Type | Labels (low cardinality) | Where to emit |
|--------|------|--------------------------|---------------|
| `auditforge_http_request_duration_ms` (already declared, **not used**) | histogram | `method, route, status` | Fastify `onResponse` hook |
| `auditforge_db_query_duration_ms` | histogram | `op, table` (no PK!) | wrap `postgres` driver |
| `auditforge_llm_call_duration_ms` | histogram | `provider, model, purpose` | `packages/llm-provider` (currently empty) |
| `auditforge_llm_call_cost_usd_total` | counter | `provider, model, tenant_bucket, purpose` | same |
| `auditforge_llm_tokens_total` | counter | `provider, model, kind=in/out` | same |
| `auditforge_probe_duration_ms` | histogram | `probe_id, mode` | `packages/probe-engine/src/runner.ts` |
| `auditforge_probe_budget_used_usd` | gauge | `engagement_id_bucket` (or hashed) | probe-runner |
| `auditforge_probe_budget_total_usd` | gauge | `engagement_id_bucket` | configmap-driven, refreshed |
| `auditforge_ledger_chain_verify_ms` | histogram | `firm_bucket` | `packages/audit-engine/src/ledger.ts:verifyChain` |
| `auditforge_ledger_chain_verify_failures_total` | counter | `firm_bucket, reason` | same |
| `auditforge_ledger_pending_events` | gauge | (none) | repo-level reader of unprocessed sequence gap |
| `auditforge_ledger_events_total` (declared, **not used**) | counter | `type, entity, firm_bucket` | `AuditTrailInterceptor` and engine emit path |
| `auditforge_retrieval_latency_ms` | histogram | `corpus, retriever` | conversational-engine retrieval |
| `auditforge_attribution_precision` | gauge | `release` | corpus regression job (per-release publish) |
| `auditforge_claim_extraction_f1` | gauge | `release` | same |
| `auditforge_contradiction_precision` | gauge | `release` | same |
| `auditforge_av_scan_enabled` | gauge | (none) | `apps/worker` AV processor heartbeat |
| `auditforge_rls_bypass_total` | counter | `surface` | RLS guard in `packages/db` |
| `auditforge_signing_failures_total` | counter | `phase` (sign/verify/renew) | `packages/report-engine/src/signing/tsa.ts` |

**Per-tenant cardinality safeguard (very important):** Do **not** emit `firm_id` directly as a Prom label. Use a `firm_bucket` (e.g., `xxhash64(firm_id) % 64`) for high-volume series and reserve raw-tenant breakdown for the audit ledger / log pipeline. Document the bucketing in the metrics module so dashboards know which series support tenant drill-down.

### HIGH-OBS-012 — `/metrics` endpoint is unauthenticated and not bound to the scrape pod IP
**File:** `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/modules/health/health.controller.ts:37-41`.

`@Public() @Get('metrics')` exposes the Prom registry on the public ingress. The Helm `api-ingress.yaml` is for cluster ingress (TLS terminated by nginx), and there is no IP allowlist/auth in front of `/metrics`. ServiceMonitor (`servicemonitor.yaml:21-25`) scrapes the same `port: http` so leaving it on the public path is unnecessary risk.

Recommendation: split into a `metrics`-only listener bound to a separate port (e.g., `9464`), and have ServiceMonitor target `port: metrics`. Or, at minimum, add an `Allow-list` annotation to the ingress for the scrape source.

### HIGH-OBS-013 — No HTTP request → metrics middleware
There is no Nest interceptor or Fastify hook that reads request duration into `httpLatencyMs`. The `histogram_quantile` formula in `AuditForgeApiP95LatencyHigh` cannot be evaluated.

Recommendation: add a `MetricsInterceptor` (Nest global interceptor) that wraps `tap` around `next.handle()`, captures `started_at`, and on `finalize` increments `auditforge_http_requests_total` and observes `auditforge_http_request_duration_ms` with `route` set to the matched Nest controller path (NOT `req.url`, which leaks IDs into label cardinality). Use `req.routeOptions?.url` as already referenced in `audit-trail.interceptor.ts:50`.

### HIGH-OBS-014 — `auditforge_ledger_events_total` not incremented from the audit-trail path
**File:** `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/common/audit-trail.interceptor.ts:44-56`. Successful `ledger.append` emits a debug log but does not bump the counter; failures only `logger.error` and similarly do not bump a `*_failures_total`.

Recommendation: in the success branch increment `ledgerEvents.inc({ type, entity, firm: bucket(firmId) })`; in the catch branch increment a new `auditforge_ledger_emit_failures_total`. Page on the latter via PrometheusRule (currently absent).

### MEDIUM-OBS-015 — `verifyChain` adapter is a stub that always returns ok=true
**File:** `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/adapters/audit-engine.adapter.ts:51-54`. The adapter is a TODO/placeholder — it never actually walks the chain, never times the operation, and never increments `auditforge_ledger_chain_verify_failures_total`. The corresponding controller endpoint (`apps/api/src/modules/audit-ledger/audit-ledger.service.ts:15-18`) returns success unconditionally.

Recommendation: until the production adapter (in `packages/audit-engine`, which *does* implement `verifyChain` properly at `ledger.ts:181-227`) is wired in, the API cannot enforce ledger integrity SLOs. Block production launch on wiring the real adapter, and add a histogram + counter wrapper at the call site.

---

## 4. Grafana dashboards

### CRITICAL-OBS-016 — All required dashboards are missing
**Path:** `c:/Users/ekess/Downloads/iso42001auditforge/infra/observability/grafana-dashboards/` is **empty** (verified with `ls -la`). None of the 9 requested dashboards exist:

| Dashboard | Status | Priority |
|----------|--------|----------|
| `api-overview` | missing | **P0** — required for API p95 SLO |
| `tenant-cost` | missing | **P0** — required for billing & LLM cost alerts |
| `audit-ledger-health` | missing | **P0** — required for 99.999 % durability SLO |
| `probe-runner` | missing | **P1** — required for 99 % availability SLO |
| `trace-analyzer` | missing | **P1** |
| `capa-aging` | missing | **P2** |
| `frontend-rum` (Core Web Vitals) | missing — and frontend is uninstrumented (CRITICAL-OBS-026) | **P1** |
| `llm-invocations` | missing — and llm-provider package is empty (CRITICAL-OBS-027) | **P0** |
| `conversational-engine-corpus-metrics` | missing — and per-release metrics not published (HIGH-OBS-029) | **P1** |

Recommendation: create the JSON exports under `infra/observability/grafana-dashboards/` and add a Helm template that loads them via Grafana sidecar or `grafana_dashboard=1` ConfigMap label. Suggested order to ship: api-overview → audit-ledger-health → llm-invocations / tenant-cost → probe-runner → frontend-rum → corpus-metrics → trace-analyzer → capa-aging.

Each dashboard must include row-level variables for `service`, `firm_bucket` (NOT `firm_id`), `engagement_id` (only on dashboards that filter by single tenant for support purposes — and gated by Grafana role).

### HIGH-OBS-017 — No OTel collector config either
**Path:** `c:/Users/ekess/Downloads/iso42001auditforge/infra/observability/otel-collector-config/` is empty. There is no `otelcol.yaml` describing the receiver/processor/exporter pipeline that Tempo and Jaeger expect. The Helm `values.yaml:476-478` points the API at `http://otel-collector.observability.svc.cluster.local:4318` but the collector is assumed to exist out-of-band.

Recommendation: ship a minimal `otelcol.yaml` (otlp receiver, batch + memory_limiter + tail-sampling processors, otlp/tempo + prometheus + loki exporters) under that path, plus a Helm subchart or documentation pointing to upstream `opentelemetry-collector` chart values.

---

## 5. Alerting

### CRITICAL-OBS-018 — Multi-window multi-burn-rate is partial; uses raw error rate, not SLO burn rate
**File:** `c:/Users/ekess/Downloads/iso42001auditforge/infra/helm/auditforge/templates/prometheusrule.yaml:18-54`.

The `AuditForgeApiHighErrorRateFastBurn` / `SlowBurn` alerts do compute an error rate against a numeric threshold (`14.4 * 0.001` and `6 * 0.001`), but:

1. They use a single window each (5m and 1h). The Google SRE multi-window-multi-burn-rate pattern requires **two windows per alert** (a long window confirming the burn rate over a meaningful duration, and a short window for fast detection) so that flapping doesn't fire and slow-burn doesn't get missed. As written, a 30-second blip can fire the fast-burn alert.
2. They reference `http_requests_total`, which is not the metric this codebase emits (the custom one is `auditforge_http_requests_total` — see CRITICAL-OBS-011).
3. They do not split by `route` or `firm_bucket`, so a single tenant's outage will not show up unless it's >0.1% of *global* traffic.
4. There is no slow-burn 6h × 30m or 24h × 6h pair, which the SRE workbook recommends for the long-tail alert.

Recommendation: rewrite using the canonical `slo:rate5m`, `slo:rate30m`, `slo:rate1h`, `slo:rate6h` recording rules and the four standard burn-rate alerts (page-fast, page-slow, ticket-fast, ticket-slow). Tools like Sloth (sloth.dev) generate these from a YAML SLO declaration; consider adopting it.

### HIGH-OBS-019 — Alerts depend on metrics no code emits
See CRITICAL-OBS-011 for the full mismatch table. Until the metrics are emitted, **none of the security-tier alerts will fire**, including `AuditForgeRLSBypassDetected` (a tenancy-isolation breach alarm) and `AuditForgeAVScanDisabled` (an evidence-integrity alarm). These are advertised as critical alarms but are functionally inert.

### HIGH-OBS-020 — `prometheusRule.enabled` defaults to `false`
**File:** `c:/Users/ekess/Downloads/iso42001auditforge/infra/helm/auditforge/values.yaml:483-486`. Even after the metrics gap is closed, alerts won't be installed by default. `values-prod.yaml` should set this to `true` and gate behind a CI check that alerts have non-empty queries.

### MEDIUM-OBS-021 — No `ProbeRunnerBacklog`, `LLMRoutingFallback`, `SignatureRenewalNotRunning`, `BackupAge` alerts
The 99 % probe-runner availability SLO needs at least: BullMQ depth, worker heartbeat (`up{job="worker"}`), DLQ growth. The 99.9 % signing pipeline SLO needs an alert on `time() - kube_job_status_completion_time{job_name=~".*archive-renewal.*"} > 26h` (the schedule is daily, so 26h means a missed run). The 99.999 % ledger durability SLO needs `time() - max(kube_job_status_completion_time{job_name=~".*pg-backup.*"}) > 26h` and a crystal-clear backup-success alert.

Recommendation: add the four alerts above. The existing `AuditForgeSignatureRenewalJobFailed` only fires on a *failed* CronJob — a missed schedule (controller down, suspended) does not set `kube_job_failed`, so the alert is silent on an entire class of incidents.

### MEDIUM-OBS-022 — Alert annotations have no runbook URLs
None of the rules set `annotations.runbook_url`. PagerDuty integration is undefined in this repo. Operators paged at 3am will have no link.

Recommendation: add `runbook_url: https://runbook.<your-domain>/<alert-name>` and create the runbook stubs (see HIGH-OBS-031).

---

## 6. Health checks

### CRITICAL-OBS-023 — Helm probe paths do not match API routes
**Files:** `c:/Users/ekess/Downloads/iso42001auditforge/infra/helm/auditforge/values.yaml:120,126,132` configures probes at `/healthz/live` and `/healthz/ready`. `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/modules/health/health.controller.ts:20,27` exposes `/healthz` and `/readyz`. They do not overlap.

Effect: every Kubernetes liveness probe will return 404, the kubelet will mark the pod `Unhealthy` and (eventually) restart it. `failureThreshold: 30` on the startup probe (values.yaml:134) gives 5 minutes before kill, which is the only reason the pods don't crashloop in the first deploy. After the startup grace expires, every API pod is killed every `failureThreshold * periodSeconds` seconds (3 × 30s = 90s) by liveness. This will not be functional in any cluster.

Recommendation (pick one):
- Change controller routes to `/healthz/live` and `/healthz/ready` (matches the values).
- Change Helm values to `/healthz` and `/readyz` (matches code).
- Either way, add an integration test under `infra/helm/auditforge/templates/tests/test-connection.yaml` that hits both `liveness` and `readiness` and asserts 200; the existing test currently hits `/healthz/live` only and would also fail.

### HIGH-OBS-024 — Liveness includes dependency check (anti-pattern)
**File:** `apps/api/src/modules/health/health.controller.ts:22-24` returns 200 unconditionally — that's correct for liveness. But once you fix CRITICAL-OBS-023, do NOT make liveness do the postgres+redis check (that's `readiness`). Wider problem: the `readiness` endpoint returns 200 with body `{ status: "degraded" }` when pg or redis is down (line 34) — kubelet does not look at the body, so a "degraded" pod stays in Service and routes traffic. Bug.

Recommendation: when pg or redis ping fails, the controller must throw or return a 503 status (`@HttpCode(503)` or `reply.status(503).send(...)`). Otherwise the readiness gate is purely cosmetic.

### MEDIUM-OBS-025 — Worker has no health endpoint at all (and no main.ts)
The worker Deployment uses `livenessProbe.exec: test -f /tmp/healthy` (`values.yaml:193-195`). No code creates `/tmp/healthy` because there is no `apps/worker/src/main.ts` (HIGH-OBS-004). Once the worker is implemented, the heartbeat file pattern is fine, but document the contract: worker writes the file every N seconds when the BullMQ connection is healthy.

---

## 7. Frontend RUM

### CRITICAL-OBS-026 — Frontend has zero observability
**File:** `c:/Users/ekess/Downloads/iso42001auditforge/apps/web/package.json` lists `next`, `react`, etc. Missing: `web-vitals`, `@sentry/nextjs`, `@vercel/analytics`, OTel browser SDK, or any RUM SDK.

There is no Core Web Vitals capture, no `LCP`/`INP`/`CLS` reporting, no client-side error capture, no network-request timing. The required `frontend-rum` Grafana dashboard cannot be built because no client telemetry exists.

Recommendation: install `web-vitals` and POST to a `/api/rum` endpoint that translates into Prom metrics (`auditforge_web_vital_lcp_ms`, etc.). Alternatively integrate `@sentry/nextjs` (matches stack spec).

---

## 8. LLM invocation telemetry

### CRITICAL-OBS-027 — `packages/llm-provider`, `packages/llm-cloud` have empty source trees
**Verified:** `packages/llm-provider/src/{providers,routing,db,templates}` are all empty. `packages/llm-cloud/src` is empty. `packages/llm-local/src` has stubs (factory, ollama, vllm) but no telemetry.

CLAUDE.md and the MCP server (`apps/mcp-server/src/audit.ts:186-201`) reference an `llm_invocations` table and a `LedgerEmitter.emitLlmInvocation` API, but no production provider exists to call it. The required `auditforge_llm_call_duration_ms`, `auditforge_llm_call_cost_usd_total`, `auditforge_llm_tokens_total` counters are not declared.

Recommendation: implement the provider package with a thin `LlmCallSpan` wrapper that:
- Starts a span `llm.call` with attributes `auditforge.llm.{provider, model, purpose, prompt_hash}` (NEVER raw prompt — see PRIVACY-OBS-033).
- Observes the duration histogram, increments token + cost counters.
- Writes the row to `llm_invocations` (cost can be computed from a price table and cached per (provider, model)).
- Emits an audit-ledger event with the same `invocationId` so trace ↔ ledger ↔ row are joinable by `invocation_id`.

### HIGH-OBS-028 — MCP `LedgerEmitter` writes to in-memory sink in default config
**Files:** `apps/mcp-server/src/audit.ts:50-69, 186-201`; `apps/mcp-server/src/index.ts:14` re-exports `./server.js` which **does not exist**. The MCP server has no working `start()` entry, so OAuth events and per-tool invocations are not emitted to a real sink. Production wiring is documented as TODO in the file header (`apps/mcp-server/src/audit.ts:7-9`).

Recommendation: implement `apps/mcp-server/src/server.ts` (transport-agnostic per the README) and the Postgres sink in `apps/api`. Until then, MCP requests are observable only via the host process logs.

---

## 9. Conversational-engine telemetry

### HIGH-OBS-029 — Corpus regression metrics are not emitted per release
**Search:** `attributionPrecision|claimExtractionF1|contradictionPrecision` returns zero matches in the codebase. The `packages/conversational-engine/src/types/domain.ts` does not contain `precision`, `recall`, or `f1` fields. The `attribution-engine.ts` exists but exposes no metric publication path.

The brief explicitly requires these to be tracked per release. Today there is nothing to graph and nothing to alert on a regression.

Recommendation: add a `tools/eval/conversational-engine.ts` script run in CI on every tag, output JSON results, and have a small "metrics-publisher" job push the values as gauges with `release` label to the Prom Pushgateway (or write a static snapshot to a configmap consumed by Grafana JSON model). Page on `delta` thresholds.

---

## 10. Audit-ledger correlation

### HIGH-OBS-030 — `request_id ↔ ledger_event_id ↔ trace_id` chain is partial
**Files:** `apps/api/src/common/audit-trail.interceptor.ts:44-56`, `apps/api/src/common/rls.middleware.ts:31-53`, `apps/api/src/adapters/audit-engine.adapter.ts:38-49`, `packages/audit-engine/src/ledger.ts:108-162`.

What works:
- `requestId` is generated in `RlsContextMiddleware` and stored in `RequestContextStore`.
- The interceptor passes `requestId` into `ledger.append`, and the adapter persists it on the `LedgerEvent`.

What's missing:
- `trace_id` is not captured anywhere. The OTel active span is never read inside the interceptor or middleware. The ledger event is not linked back to the trace.
- The `LedgerEventInput` type (adapter line 8-18) has no `traceId` / `spanId` fields, so even if you read them you can't store them.
- The `producer` field on the engine-side `LedgerEvent` (`packages/audit-engine/src/ledger.ts:18`) is set to a hardcoded service name; it does not include the request_id either.
- The engine's in-memory `verifyChain` covers only chain-hash validity; it does not log/metric the time it took (so the `ledgerChainVerifyMs` metric and any latency SLO are unmeasurable).

Recommendation:
- Extend the request-context to capture `traceId = trace.getActiveSpan()?.spanContext().traceId`.
- Add `traceId`, `spanId` columns on the audit-ledger DB table and on `LedgerEventInput`.
- Add `traceId` to the pino mixin so the same value appears on the log line that says "ledger.append firm=X type=Y seq=Z".
- Have the audit-trail interceptor set a span attribute `auditforge.ledger.event_id` after `append` returns, so a Tempo trace can hyperlink to the ledger row.

---

## 11. MCP server telemetry

### HIGH-OBS-031 — MCP server has no entrypoint and no metrics surface
**Files:** `apps/mcp-server/src/index.ts:14` re-exports `./server.js`; that file is not in the tree (verified). `apps/mcp-server/src/audit.ts` and `auth.ts` are well-structured ports but unused at runtime. There is no `/metrics` for tool call counts or auth-deny rates.

Recommendation: implement the `start()` entrypoint with a Fastify (or stdio) transport; register a metrics interceptor that emits `auditforge_mcp_tool_invocations_total{tool, verdict}`, `auditforge_mcp_auth_deny_total{error_code}`, and `auditforge_mcp_tool_latency_ms`. Add a separate ServiceMonitor template `mcp-servicemonitor.yaml` once the MCP Helm template exists (currently absent — only api/web/worker have Deployments).

---

## 12. DR + backup

### HIGH-OBS-032 — DR posture is partial and undocumented
**Files:**
- Backup CronJob: `infra/helm/auditforge/templates/backup-cronjob.yaml` runs `pg_basebackup` daily at 02:00 UTC (`values.yaml:438-441`), uploads to S3.
- Archive renewal CronJob: `archive-renewal-cronjob.yaml` runs daily at 04:00 UTC, calls a `worker dist/cli.js archive:renew-signatures` CLI that does not exist (HIGH-OBS-004).
- WAL archiving / continuous archiving: not configured. Postgres StatefulSet (`postgres-statefulset.yaml`) has no `archive_command` or replication.
- Restore tooling: no `restore.sh` or runbook.
- `docs/architecture/disaster-recovery.md`: **does not exist** (verified — `docs/architecture/` only has `threat-model.md`).
- RPO / RTO documented anywhere: no.

For a 99.999 % durability target, the daily basebackup gives a worst-case **24h RPO**. That is two orders of magnitude worse than the SLO promises. WAL archiving every minute would bring RPO to ~1m but is not enabled.

Recommendation:
- Enable Postgres continuous WAL archiving (or run pgBackRest / wal-g sidecar) targeting the same S3 bucket. Document RPO ≤ 5 min.
- Test restore quarterly and capture timing in a `docs/architecture/disaster-recovery.md` (target RTO ≤ 1 h).
- Add a `auditforge_backup_age_seconds` gauge published by the backup job's success postscript and a `BackupTooOld` alert (`max_over_time(auditforge_backup_age_seconds[2h]) > 90000`).

### MEDIUM-OBS-033 — Archive-renewal CronJob will fail on first run
The CronJob calls `node dist/cli.js archive:renew-signatures --ledger=long-term` but `apps/worker/dist/cli.js` does not exist (worker source is empty; no `cli.ts`). Job will exit non-zero, eventually hit `backoffLimit: 2`, and the alert `AuditForgeSignatureRenewalJobFailed` (which itself has a metric mismatch issue — see CRITICAL-OBS-011) will not fire because PrometheusRule defaults to disabled (HIGH-OBS-020).

---

## 13. Runbooks

### HIGH-OBS-034 — Runbooks do not exist
**Verified empty:** `docs/admin-guide/` (no `operations.md`), `docs/compliance/` (empty), no `docs/admin-guide/chaos-runbook.md`. Operators will receive critical alerts (chain-verify failure, RLS bypass, signature renewal job failure, AV scan disabled) with no documented response procedure.

Recommendation: create at minimum the following runbooks under `docs/admin-guide/runbooks/`:
- `chain-verify-failure.md` — investigate possible tampering, freeze writes, run forensic verify on cold backup, contact CISO.
- `rls-bypass.md` — rotate Postgres role passwords, audit `pg_stat_activity`, review last 24h of queries via pg_audit.
- `signature-renewal-failure.md` — re-run job manually, escalate to TSA provider, verify archive integrity.
- `av-scan-disabled.md` — quarantine new uploads, restart AV worker, alert security.
- `probe-budget-breach.md` — investigate cost spike per engagement, possibly suspend engagement.
- `llm-cost-spike.md` — identify tenant + tool, throttle per `apps/api/src/common/throttler.config.ts`.

Add `docs/admin-guide/operations.md` for routine ops (rolling deploys, secret rotation, certificate renewal) and a `docs/admin-guide/chaos-runbook.md` documenting which experiments are safe to run in prod (network partition, pod kill, redis failover, postgres failover) and the SLO impact of each.

### MEDIUM-OBS-035 — No observability ADR
There is no `docs/adr/00XX-observability-stack.md`. Decisions like "Prom + OTel collector + Tempo + Loki + Sentry" are not codified, so the inconsistencies (Sentry deps absent, Loki absent) cannot be tracked as drift.

---

## 14. Privacy / sampling defaults

### HIGH-OBS-036 — No PII guard on OTel attributes
**Files:** `apps/api/src/otel.ts` does not configure a SpanProcessor that strips/hashes attributes. `apps/api/src/common/audit-trail.interceptor.ts:53` writes `payload: { method: req.method, path: req.url }` — `req.url` may contain PII (e.g., `/findings?email=alice@example.com&q=...`). The HTTP auto-instrumentation will already emit `http.target` / `http.url` with the same content into the span. With current config, those go to the collector unsanitized.

Recommendation: write a SpanProcessor that:
- Drops query strings on `http.target` and `http.url`.
- Replaces UUIDs in path with `:id`.
- Strips `Authorization` / `Cookie` even though the Node SDK already redacts headers (defense in depth).
- Hashes `db.statement` parameters.

### HIGH-OBS-037 — No per-tenant sampling control
Brief: "sampling configurable per-tenant." Currently OTel uses `AlwaysOn` (default), no per-tenant override. A noisy enterprise tenant will dominate the trace store and starve smaller tenants.

Recommendation: ship a custom `Sampler` that reads `auditforge.tenant_id` from the span attributes and falls back to a per-tenant ratio loaded from a `ConfigMap` watched at runtime. Default 10 %, lower for hot tenants.

### MEDIUM-OBS-038 — Prom labels risk PII exposure
The `auditforge_ledger_events_total` declares a `firm` label (`apps/api/src/common/metrics.ts:25`) — if `firm` is the firm UUID this will explode label cardinality and may leak tenant existence to anyone with `/metrics` access. See CRITICAL-OBS-011 recommendation about `firm_bucket`.

---

## 15. Cross-cutting / smaller items

### LOW-OBS-039 — `pino-http`'s `autoLogging: true` will log request bodies on errors
**File:** `apps/api/src/app.module.ts:59`. In Fastify, this pulls request body summaries into the log line. With the limited redact list, sensitive bodies will leak.

### LOW-OBS-040 — The `NotImplementedError` and `unknown` audit-trail entries
**File:** `apps/api/src/common/audit-trail.interceptor.ts:42-52`. When `meta` and the response object lack an `id`, the entityId is logged as the literal string `unknown`. This means a class of mutations (DELETE returning 204 No Content, void mutations) will produce ledger entries you can't tie back to anything.

Recommendation: require `AuditMeta.entityIdParam` to be set on every controller annotated with `@AuditTrail(...)`, or have the metadata explicitly opt out (`{ entityId: 'none' }`).

### LOW-OBS-041 — Default Prom registry collisions
`apps/api/src/common/metrics.ts:4-5` creates a brand new `Registry` and calls `collectDefaultMetrics({ register: metricsRegistry })`. This is fine, but `prom-client` keeps a global registry too. If any future package calls `collectDefaultMetrics()` without explicit register, it will append to the global registry — invisible from `/metrics`. Document the convention or import a `getRegistry()` factory.

### INFO-OBS-042 — Sentry is in stack spec but absent from repo
`Grep "sentry|@sentry"` finds only `packages/probe-engine/src/adapters/garak.ts` (likely a probe target string, not the SDK). Decide if Sentry is in or out; if in, add `@sentry/node`, `@sentry/nextjs`, and a `SENTRY_DSN` config var.

### INFO-OBS-043 — Trace-analyzer package has its own retention model
`packages/trace-analyzer/` produces traces of agent runs (different concern from APM traces). Worth calling out in the future observability ADR so operators don't conflate "trace-analyzer trace" (a domain artifact) with "OTel trace" (a telemetry primitive).

---

## Required dashboards / alerts not yet present (consolidated, prioritized)

**P0 — must ship before any production-grade SLO claim**
- `api-overview` Grafana dashboard
- `audit-ledger-health` Grafana dashboard
- `llm-invocations` Grafana dashboard
- `tenant-cost` Grafana dashboard
- HTTP request metric emission (CRITICAL-OBS-013)
- Custom metrics emission table in CRITICAL-OBS-011
- Multi-window-multi-burn-rate SLO recording rules (CRITICAL-OBS-018)
- Health-probe path alignment (CRITICAL-OBS-023)
- ConfigMap OTel env var alignment (CRITICAL-OBS-001)
- OTel auto-instrumentation actually starts (CRITICAL-OBS-001 + 005)
- DR doc + WAL archiving (HIGH-OBS-032)

**P1**
- `probe-runner`, `frontend-rum`, `conversational-engine-corpus-metrics` dashboards
- `BackupTooOld`, `ProbeRunnerBacklog`, `LLMRoutingFallback`, `MissedArchiveRenewal` alerts
- Runbooks for the 6 critical alerts
- Pino mixin for trace-id correlation
- LLM telemetry wiring (CRITICAL-OBS-027)
- Frontend RUM (CRITICAL-OBS-026)

**P2**
- `trace-analyzer`, `capa-aging` dashboards
- Per-tenant sampler
- Observability ADR
- OTel collector config bundle

---

## Source citations (paths verified during this review)

- `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/otel.ts:1-22`
- `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/main.ts:14-18,64`
- `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/app.module.ts:56-62,100-108`
- `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/common/metrics.ts:1-28`
- `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/common/audit-trail.interceptor.ts:30-60`
- `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/common/rls.middleware.ts:24-55`
- `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/common/request-context.ts:1-30`
- `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/modules/health/health.controller.ts:13-42`
- `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/modules/audit-ledger/audit-ledger.service.ts:7-19`
- `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/adapters/audit-engine.adapter.ts:38-55`
- `c:/Users/ekess/Downloads/iso42001auditforge/apps/api/src/config/config.schema.ts:36-37`
- `c:/Users/ekess/Downloads/iso42001auditforge/apps/worker/package.json:8-21`
- `c:/Users/ekess/Downloads/iso42001auditforge/apps/worker/src/` (empty `processors/`, `adapters/`; no `main.ts`)
- `c:/Users/ekess/Downloads/iso42001auditforge/apps/mcp-server/src/index.ts:14` (re-exports a missing `server.ts`)
- `c:/Users/ekess/Downloads/iso42001auditforge/apps/mcp-server/src/audit.ts:1-219`
- `c:/Users/ekess/Downloads/iso42001auditforge/apps/web/package.json` (no RUM / Sentry deps)
- `c:/Users/ekess/Downloads/iso42001auditforge/packages/audit-engine/src/ledger.ts:181-227` (real verifyChain, currently unused by the API adapter)
- `c:/Users/ekess/Downloads/iso42001auditforge/packages/probe-engine/src/runner.ts:1-50`
- `c:/Users/ekess/Downloads/iso42001auditforge/packages/llm-provider/src/{providers,routing,db,templates}/` (all empty)
- `c:/Users/ekess/Downloads/iso42001auditforge/packages/llm-cloud/src/` (empty)
- `c:/Users/ekess/Downloads/iso42001auditforge/packages/conversational-engine/src/types/domain.ts` (no precision/recall/f1 fields)
- `c:/Users/ekess/Downloads/iso42001auditforge/infra/helm/auditforge/templates/configmap.yaml:13-14`
- `c:/Users/ekess/Downloads/iso42001auditforge/infra/helm/auditforge/templates/api-deployment.yaml:96-104`
- `c:/Users/ekess/Downloads/iso42001auditforge/infra/helm/auditforge/templates/prometheusrule.yaml:1-129`
- `c:/Users/ekess/Downloads/iso42001auditforge/infra/helm/auditforge/templates/servicemonitor.yaml:1-26`
- `c:/Users/ekess/Downloads/iso42001auditforge/infra/helm/auditforge/templates/backup-cronjob.yaml:1-77`
- `c:/Users/ekess/Downloads/iso42001auditforge/infra/helm/auditforge/templates/archive-renewal-cronjob.yaml:1-53`
- `c:/Users/ekess/Downloads/iso42001auditforge/infra/helm/auditforge/values.yaml:118-134, 192-201, 438-486`
- `c:/Users/ekess/Downloads/iso42001auditforge/infra/observability/grafana-dashboards/` (empty)
- `c:/Users/ekess/Downloads/iso42001auditforge/infra/observability/otel-collector-config/` (empty)
- `c:/Users/ekess/Downloads/iso42001auditforge/docs/architecture/` (only `threat-model.md`; no `observability.md`, no `disaster-recovery.md`)
- `c:/Users/ekess/Downloads/iso42001auditforge/docs/admin-guide/` (empty)
- `c:/Users/ekess/Downloads/iso42001auditforge/docs/compliance/` (empty)

---

## Summary findings counts

- CRITICAL: 7 (OBS-001, 002, 003, 011, 016, 023, 026, 027)  *(8 actually — see below)*
- HIGH: 14
- MEDIUM: 7
- LOW / INFO: 6

(Re-counted: CRITICAL is 8 — OBS-001, 002, 003, 011, 016, 023, 026, 027.)

The cluster of CRITICALs centered on metrics + dashboards + config-misalignment means **the SLO claims advertised in this review brief cannot be measured today**. Closing CRITICAL-OBS-001 (OTel env var alignment) and CRITICAL-OBS-023 (health probe path) is a one-line fix per item and unblocks a working baseline; everything else requires net-new code under `packages/observability` plus the per-package instrumentation calls.
