<!-- SPDX-License-Identifier: BUSL-1.1 -->
# AuditForge — Scaling Guide

## Per-service sizing baseline

| Service              | Baseline (single firm) | At 100 firms          | Scaling axis              |
| -------------------- | ---------------------- | --------------------- | ------------------------- |
| api                  | 3× 0.5 vCPU / 1 Gi     | 30× 1 vCPU / 2 Gi     | RPS, p95 latency          |
| worker               | 4× 0.5 vCPU / 1 Gi     | 40× 1 vCPU / 4 Gi     | BullMQ queue depth        |
| web                  | 3× 0.1 vCPU / 0.5 Gi   | 10× 0.5 vCPU / 1 Gi   | Concurrent SSR            |
| mcp-server           | 3× 0.1 vCPU / 0.25 Gi  | 6× 0.25 vCPU / 0.5 Gi | MCP requests/sec          |
| audit-evidence-runner| 3× 1 vCPU / 2 Gi       | 8× 4 vCPU / 16 Gi     | Probe queue depth         |
| transcription-py     | 2× GPU (T4)            | 4× GPU (A10G)         | Active interview minutes  |
| vlm-py               | 2× GPU (A10G)          | 4× GPU (A100/40G)     | VLM extraction queue      |
| Postgres             | db.r6g.large           | db.r6g.4xlarge        | Connection count, IOPS    |
| Redis                | 2× cache.r7g.large     | 3× cache.r7g.xlarge   | Memory + ops/sec          |

## HPA tuning recipe

For api/web (latency-driven):

```yaml
metrics:
  - type: Resource
    resource: { name: cpu,    target: { type: Utilization, averageUtilization: 70 } }
  - type: Resource
    resource: { name: memory, target: { type: Utilization, averageUtilization: 80 } }
  - type: Pods
    pods:
      metric: { name: http_request_duration_p95_milliseconds }
      target: { type: AverageValue, averageValue: "300" }
```

For worker (queue-driven):

```yaml
metrics:
  - type: External
    external:
      metric: { name: probe_queue_depth }
      target: { type: AverageValue, averageValue: "10" }
```

## Capacity-planning math

For api at p95 ≤ 300 ms:

- Per pod: ~50 RPS sustained at 70% CPU on m6i node share
- Headroom: target 60% of HPA max so burst is absorbed without throttling
- Replica count: `ceil(peak_RPS / 50 / 0.6)`
- Example: 600 RPS peak → ceil(600/50/0.6) = 20 pods

For worker queues:

- BullMQ throughput ≈ 200 jobs/min/pod for probe jobs
- Backpressure threshold: queue depth > 10 jobs/replica triggers scale-up
- Replica count: `ceil(peak_jobs_per_min / 200)`

## Postgres scaling

- Vertical first: scale instance class up to `r6g.4xlarge` before sharding
- Horizontal: read replicas for read-heavy workloads (catalogue queries, dashboard reads)
- pgvector index choice: `ivfflat` lists = 4× sqrt(rows); `hnsw` for write-heavy

## Cost-aware scaling

- audit-evidence-runner uses Spot/SpotInterruptible nodes — set
  `tolerations: [{ key: spot, operator: Equal, value: "true", effect: NoSchedule }]`
- GPU workloads (transcription-py, vlm-py) on dedicated node group with
  taint `nvidia.com/gpu=true:NoSchedule`
- HPA `behavior` block to dampen flapping:
  ```yaml
  behavior:
    scaleDown: { stabilizationWindowSeconds: 300, policies: [{ type: Percent, value: 50, periodSeconds: 60 }] }
    scaleUp:   { stabilizationWindowSeconds: 30,  policies: [{ type: Percent, value: 100, periodSeconds: 60 }] }
  ```
