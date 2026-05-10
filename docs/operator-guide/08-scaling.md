<!--
SPDX-License-Identifier: BUSL-1.1
-->

# Scaling

> HorizontalPodAutoscaler configuration, vertical sizing guidelines,
> and capacity planning math for AuditForge.

---

## Horizontal Scaling

The Helm chart ships HPAs for `api`, `worker`, and `mcp-server`. Adjust
in `my-values.yaml`:

```yaml
api:
  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 10
    targetCPUUtilizationPercentage: 70
    targetMemoryUtilizationPercentage: 80

worker:
  autoscaling:
    enabled: true
    minReplicas: 1
    maxReplicas: 20
    # Worker scales on BullMQ queue depth via KEDA (optional)
    keda:
      enabled: false
      queueLengthThreshold: 50
```

For worker scaling based on queue depth, deploy **KEDA** and configure
the `ScaledObject` targeting the `evidence:extract` and `probe:run`
queues in Redis.

**Stateless components** (api, web, mcp-server) scale horizontally
without coordination. WebSocket rooms (Yjs) are stateful: ensure that
sticky sessions or a Redis-backed Yjs room store is configured when
api replicas > 1. The Helm chart enables Redis room persistence by
default.

**Stateful components** (Postgres, MinIO, Meilisearch, Ollama) do not
scale horizontally in the default chart. Use managed services or their
own Operators for HA.

---

## Vertical Sizing

| Component | Min (dev) | Recommended (10 concurrent auditors) | High-load (100+) |
|---|---|---|---|
| API pod | 0.5 CPU / 512 Mi | 2 CPU / 2 Gi | 4 CPU / 4 Gi × N pods |
| Worker pod | 1 CPU / 1 Gi | 4 CPU / 4 Gi | 8 CPU / 8 Gi × N pods |
| Postgres | 2 CPU / 4 Gi | 8 CPU / 32 Gi | Managed RDS r7g.2xlarge+ |
| Redis | 0.5 CPU / 512 Mi | 2 CPU / 4 Gi | Managed ElastiCache r7g.large |
| MinIO | 2 CPU / 4 Gi | 8 CPU / 32 Gi | Distributed MinIO 4+ nodes |
| Meilisearch | 1 CPU / 2 Gi | 4 CPU / 8 Gi | Single node sufficient to 10M docs |
| Ollama (8B model) | 8 GB VRAM | A10G (24 GB VRAM) | A100 (80 GB) for 32B |

---

## Capacity Planning Math

**Evidence extraction throughput**:

- Qwen2.5-VL on A10G: ~3 pages/second.
- 10 concurrent extraction jobs: 30 pages/second ≈ 2,500 pages/minute.
- A typical audit engagement: 200–1,000 pages of evidence.
- Expected extraction time per engagement: 0.1–7 minutes.

**LLM attribution throughput** (medium tier, Qwen 2.5 32B on A100):

- ~2,000 tokens/second output.
- Attribution call: ~500 tokens input + 200 tokens output.
- Throughput: ~2,800 attributions/hour per A100.
- At 10 concurrent sessions each generating 100 utterances: 1,000
  attributions → ~20 minutes per 10-session batch.

**Postgres write rate**:

- Each ledger event write: ~1 ms on a single Postgres node.
- Peak: 100 concurrent sessions each generating 10 events/second =
  1,000 events/second. Requires connection pooling (PgBouncer) with
  pool size ≥ 50.

---

## Related Documents

- [07-monitoring-and-alerting.md](07-monitoring-and-alerting.md) —
  metrics to watch when scaling.
- [12-cost-management.md](12-cost-management.md) — GPU cost planning.
