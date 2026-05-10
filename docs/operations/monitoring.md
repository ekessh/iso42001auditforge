<!-- SPDX-License-Identifier: BUSL-1.1 -->
# AuditForge — Monitoring & SLOs

## Stack

- **Metrics:** Prometheus (kube-prometheus-stack) — every service exposes `/metrics`
- **Logs:** Loki + promtail — structured JSON, retention 90d (prod) / 30d (staging)
- **Traces:** Tempo — OTEL collector in observability namespace
- **Dashboards:** Grafana — provisioned via `infra/grafana/`
- **Alerts:** Alertmanager → PagerDuty (Sev1/2) and Opsgenie fallback

## Grafana dashboards (cross-link wave 3)

| Dashboard                          | Path                         |
| ---------------------------------- | ---------------------------- |
| AuditForge — Service Overview      | `grafana/dashboards/service-overview.json` |
| AuditForge — Engagement Throughput | `grafana/dashboards/engagement-throughput.json` |
| AuditForge — LLM Provider Routing  | `grafana/dashboards/llm-routing.json` |
| AuditForge — Audit Ledger Health   | `grafana/dashboards/ledger-health.json` |
| AuditForge — Probe Runner          | `grafana/dashboards/probe-runner.json` |
| AuditForge — Receipt Chain         | `grafana/dashboards/receipt-chain.json` |

## SLOs

| Service          | SLI                              | SLO       | Error budget          |
| ---------------- | -------------------------------- | --------- | --------------------- |
| api `/healthz`   | Successful probe ratio           | 99.9% (30d)| 43 min/month          |
| api p95          | Request latency                  | < 300 ms  | 10% slow over 7d      |
| Audit ledger     | Successful signed-write rate     | 99.99%    | 4 min/month           |
| Probe runner     | Probe completion within budget   | 95%       | 5% retries            |
| Cloud LLM (opt-in)| Round-trip < 30 s, 95th         | 95%       | 5% slow               |

## Burn-rate alerts

```yaml
- alert: AuditForgeApiSLOFastBurn
  expr: |
    (
      sum(rate(http_requests_total{job="auditforge-api",code=~"5.."}[5m]))
      /
      sum(rate(http_requests_total{job="auditforge-api"}[5m]))
    ) > (14.4 * (1 - 0.999))
  for: 2m
  labels: { severity: page, slo: api-availability }

- alert: AuditForgeApiSLOSlowBurn
  expr: |
    (
      sum(rate(http_requests_total{job="auditforge-api",code=~"5.."}[1h]))
      /
      sum(rate(http_requests_total{job="auditforge-api"}[1h]))
    ) > (3 * (1 - 0.999))
  for: 30m
  labels: { severity: page, slo: api-availability }

- alert: AuditLedgerChainBreak
  expr: increase(audit_ledger_chain_break_total[5m]) > 0
  for: 0m
  labels: { severity: page, severity_level: sev1 }
  annotations:
    summary: "Audit ledger receipt-chain validation failed."
    runbook: "infra/runbooks/incident-response.md#special-signed-receipt-break"
```

## Alert routing

- Sev1 → PagerDuty primary on-call (5 min ack)
- Sev2 → PagerDuty primary on-call (15 min ack)
- Sev3 → Slack `#auditforge-ops`
- Sev4 → tracker only

## Observability gates

Every new service template MUST include:

- `/metrics` endpoint with at least: `up`, request count, request duration histogram
- ServiceMonitor (Prometheus operator) — emit by default
- OTEL trace propagation via `traceparent` header
- Structured JSON log lines: `{ts, level, msg, request_id, trace_id, ...}`
