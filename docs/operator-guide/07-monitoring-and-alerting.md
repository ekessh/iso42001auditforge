<!--
SPDX-License-Identifier: BUSL-1.1
-->

# Monitoring and Alerting

> Grafana dashboards, Prometheus alert rules, and SLO burn-rate alerts
> for AuditForge.

---

## Metrics Stack

AuditForge exposes Prometheus metrics at `GET /metrics` on port 4000.
The Helm chart deploys a ServiceMonitor for the Prometheus Operator.

Dashboard sources are in `infra/grafana/`. Import them into Grafana via
the Helm chart's `grafana.dashboards` values or manually.

---

## Dashboards

| Dashboard file | What it shows |
|---|---|
| `infra/grafana/api-overview.json` | Request rate, error rate, p50/p95/p99 latency, active WebSocket rooms |
| `infra/grafana/worker-queue.json` | BullMQ queue depth, job throughput, failed job rate per queue |
| `infra/grafana/llm-invocations.json` | LLM calls by tier, token consumption, cost, latency, provider breakdown |
| `infra/grafana/audit-ledger.json` | Events/min, chain tip sequence, TSA anchor lag |
| `infra/grafana/engagement-funnel.json` | Engagement creation rate, stage distribution, issuance throughput |
| `infra/grafana/postgres.json` | Connection pool utilization, slow queries, replication lag |

---

## Key SLOs

| SLO | Target | Alert threshold |
|---|---|---|
| API availability | 99.9% over 30 days | Burn rate > 5× for 1 h (fast burn) |
| API p95 latency | < 500 ms | p95 > 800 ms for 5 min |
| Evidence extraction success rate | > 95% | < 90% over 15 min |
| Ledger TSA anchor lag | < 5 min | > 10 min |
| Report signing success rate | > 99.9% | Any failure in 1 h |

Alert rules are in `infra/observability/prometheus/rules.yaml`.

---

## SLO Burn-Rate Alerts (Multi-Window)

The alert strategy follows the Google SRE Workbook multi-window approach:

```
# Fast burn (1h): 5× rate → ~6 days of error budget remaining
- alert: APIAvailabilityFastBurn
  expr: |
    (
      sum(rate(http_requests_total{job="auditforge-api",code=~"5.."}[1h]))
      / sum(rate(http_requests_total{job="auditforge-api"}[1h]))
    ) > (5 * 0.001)
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "AuditForge API fast error burn rate"

# Slow burn (6h): 2× rate → ~15 days remaining
- alert: APIAvailabilitySlowBurn
  expr: |
    (
      sum(rate(http_requests_total{job="auditforge-api",code=~"5.."}[6h]))
      / sum(rate(http_requests_total{job="auditforge-api"}[6h]))
    ) > (2 * 0.001)
  for: 15m
  labels:
    severity: warning
```

Full alert rules in `infra/observability/prometheus/rules.yaml`.

---

## Tracing

AuditForge emits OpenTelemetry traces from:

- NestJS API (via `@opentelemetry/instrumentation-nestjs-core`).
- BullMQ worker jobs.
- LLM invocations (custom span per call).
- Ledger writes.

Configure `OTEL_EXPORTER_OTLP_ENDPOINT` to point to your collector
(Jaeger, Grafana Tempo, or a cloud trace backend).

---

## Related Documents

- `infra/observability/prometheus/rules.yaml` — full alert rule source.
- `infra/grafana/` — dashboard JSON sources.
- [../developer-guide/10-debugging.md](../developer-guide/10-debugging.md)
  — developer OTEL drill-down guide.
