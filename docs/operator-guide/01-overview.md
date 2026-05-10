<!--
SPDX-License-Identifier: BUSL-1.1
-->

# Operator Guide — Overview

> This document describes the runtime architecture, component topology,
> and data flows that an operator must understand before deploying or
> managing AuditForge.

---

## Component Map

```
┌─────────────────────────────────────────────────────────┐
│  Client tier                                            │
│  apps/web (Next.js 15)  apps/desktop (Tauri 2)  PWA    │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS / WebSocket
┌────────────────────────▼────────────────────────────────┐
│  API tier                                               │
│  apps/api  (NestJS modular monolith, port 4000)         │
│  apps/worker (BullMQ, shares API packages)              │
│  apps/mcp-server (Model Context Protocol, port 4001)    │
└──┬─────────────────┬──────────────────┬─────────────────┘
   │                 │                  │
   ▼                 ▼                  ▼
Postgres 16      Redis 7           MinIO / S3
(+ pgvector      (cache +          (evidence vault)
 + RLS)          BullMQ queues)
   │
   ▼
Meilisearch      Ollama / vLLM     services/
(full-text       (local LLM        transcription-py
 search)         inference)        vlm-py
                                   probe-runner-py
                                   audit-evidence-runner
```

All components are containerized. The canonical production deployment
uses Helm on Kubernetes.

---

## Data Flows

### Audit engagement flow

See [../diagrams/data-flow-engagement.mmd](../diagrams/data-flow-engagement.mmd).

1. Auditor browser → Next.js → NestJS API.
2. API writes to Postgres (with RLS enforced at connection level via
   `SET LOCAL app.tenant_id`).
3. API emits ledger events to `audit_ledger_events` table.
4. API sends work to BullMQ (Redis).
5. Worker picks up jobs: probe execution, evidence extraction, PDF
   rendering.

### Evidence extraction flow

See [../diagrams/data-flow-evidence-extraction.mmd](../diagrams/data-flow-evidence-extraction.mmd).

1. Browser uploads directly to MinIO via presigned URL.
2. API finalizes the upload and enqueues extraction.
3. Worker calls `vlm-py` gRPC service.
4. `vlm-py` returns structured claims; worker writes to Postgres.

### Collaborative editing flow

See [../diagrams/crdt-sync.mmd](../diagrams/crdt-sync.mmd).

1. Browser connects to the NestJS WebSocket gateway (y-websocket).
2. RBAC is checked per room subscription.
3. Yjs ops are relayed; IndexedDB provides offline persistence.

---

## Tenancy Model

AuditForge uses **Postgres Row-Level Security** for tenant isolation
(ADR-0003, ADR-0017). Each request sets `app.tenant_id` and
`app.user_id` as session-local variables before any SQL is executed.
RLS policies on every table filter rows by `tenant_id`.

The application-layer guard additionally rejects cross-tenant API calls
before reaching the DB. Defense in depth: RLS is the last line, not
the only line.

---

## Port Reference

| Service | Default port |
|---|---|
| Next.js web | 3000 |
| NestJS API | 4000 |
| MCP server | 4001 |
| Postgres | 5432 |
| Redis | 6379 |
| MinIO API | 9000 |
| MinIO Console | 9001 |
| Meilisearch | 7700 |
| Ollama | 11434 |
| Prometheus | 9090 |
| Grafana | 3001 |
| Jaeger / OTEL collector | 4317 (gRPC), 4318 (HTTP) |
| transcription-py gRPC | 50051 |
| vlm-py gRPC | 50052 |
| probe-runner-py gRPC | 50053 |

---

## Related Documents

- [02-prerequisites.md](02-prerequisites.md) — supported environments.
- [03-installation.md](03-installation.md) — Helm install.
- [../concepts/audit-ledger.md](../concepts/audit-ledger.md) — ledger
  internals.
