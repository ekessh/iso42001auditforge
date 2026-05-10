<!--
SPDX-License-Identifier: BUSL-1.1
-->

# Cost Management

> Total cost of ownership, cost dashboards, and LLM budget controllers.

---

## TCO Components

| Component | Cost driver | Optimization lever |
|---|---|---|
| Kubernetes compute | CPU/memory hours for API, worker, web | HPA right-sizing; spot instances for worker |
| GPU compute | LLM inference (Ollama/vLLM) | Batch scheduling; model quantization (Q4_K_M vs FP16) |
| Postgres storage | Engagement data + ledger events (append-only) | pg_partman archival; pg_compress for old partitions |
| MinIO/S3 storage | Evidence files | S3 Intelligent-Tiering; lifecycle rules for old evidence |
| Cloud LLM (if opted-in) | Token consumption (Anthropic / OpenAI) | Per-engagement budget caps; local fallback |
| TSA calls | One call per `report.publish` event | Negligible cost; FreeTSA is free |
| Egress | API responses, MinIO downloads | CDN for static assets; presigned S3 URLs bypass API egress |

---

## LLM Cost Controller

AuditForge has a built-in LLM budget controller in `packages/cost-controller`:

- **Per-engagement cap**: set `llmBudgetUsd` on the engagement. When the
  cap is exceeded, the system falls back to the local LLM tier.
- **Global monthly cap**: set `COST_BUDGET_MONTHLY_USD` env var. When
  reached, all cloud LLM is suspended until the next calendar month.
- **Pre-operation preview**: before high-volume operations (bulk evidence
  extraction, probe suites), the system estimates token cost and
  requires auditor approval if the estimate exceeds 10% of the
  engagement budget.

---

## Cost Dashboard

`infra/grafana/llm-invocations.json` shows:

- Daily token spend by provider (local vs Anthropic vs OpenAI).
- Cost per engagement.
- Cost per LLM tier.
- Running total vs monthly budget cap.

---

## Optimization Recommendations

| Action | Typical saving |
|---|---|
| Use Q4_K_M quantized models instead of FP16 | 50–70% GPU memory; <3% quality loss on attribution tasks |
| Schedule evidence extraction during off-peak hours | No cost saving, but reduces GPU contention during interviews |
| Enable `LEDGER_ANCHOR_INTERVAL_MS=300000` (5 min batching) | Reduces TSA calls by ~5× during active sessions |
| Enable S3 Intelligent-Tiering on evidence bucket | 40–60% storage savings for engagements older than 30 days |
| Use spot/preemptible instances for worker pods | 60–80% worker compute cost reduction |

---

## Related Documents

- [13-air-gap-vs-cloud-LLM.md](13-air-gap-vs-cloud-LLM.md) —
  trade-offs for the largest cost variable.
- [08-scaling.md](08-scaling.md) — right-sizing guidance.
