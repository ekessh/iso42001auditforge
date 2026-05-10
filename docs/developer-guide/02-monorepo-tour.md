<!--
SPDX-License-Identifier: BUSL-1.1
-->
<!-- metadata
section: developer-guide
audience: contributor
cross-refs:
  - docs/adr/0001-modular-monolith.md
  - docs/developer-guide/03-tech-stack.md
-->

# Monorepo Tour

> This document explains the layout of the AuditForge monorepo and why
> each package exists.

---

## Top-Level Structure

```
auditforge/
├── apps/           Next.js web, NestJS API, BullMQ worker, Tauri desktop, mobile PWA, MCP server
├── packages/       Shared TypeScript libraries (domain logic, schema, UI kit)
├── services/       Python gRPC sidecars (VLM, transcription, probe runner)
├── infra/          Docker Compose, Helm, Terraform, observability config
├── tests/          e2e, load (k6), security (Semgrep), probe-validity
├── scripts/        Build and maintenance scripts
├── docs/           All documentation (you are here)
└── semgrep/        Custom Semgrep rules enforcing CLAUDE.md hard rules
```

---

## `apps/`

| App | Technology | Purpose |
|---|---|---|
| `api` | NestJS + Drizzle | The core API. All business logic. All audit modules. |
| `web` | Next.js 15 | Auditor-facing browser UI. App Router, Server Components, Tailwind, shadcn/ui. |
| `worker` | BullMQ | Background jobs: probe execution, evidence extraction, PDF rendering, LLM invocations, TSA anchoring. |
| `desktop` | Tauri 2 | Native desktop shell wrapping the web UI. Adds offline persistence + system keychain for passkeys. |
| `mobile` | PWA (Next.js) | Progressive web app for mobile. Shares code with `apps/web`. |
| `mcp-server` | Hono + MCP SDK | Exposes AuditForge tools via the Model Context Protocol for Claude Desktop / IDE integration. |

---

## `packages/`

| Package | Depends on | Purpose |
|---|---|---|
| `db` | Drizzle, Postgres | Drizzle schema, migrations, DB client factory, RLS session helpers. |
| `shared` | — | Zod schemas, DTOs, utility types shared across the monorepo. |
| `ui-kit` | React, Tailwind, shadcn/ui | AuditForge design system: components, icons, tokens. |
| `auth-core` | `db` | WebAuthn, OIDC, RBAC, session validation. Used by API and y-websocket gateway. |
| `audit-engine` | `db` | Chain verifier, event emitter, projection rebuilder. |
| `audit-memory` | `db`, `llm-provider` | Episodes, claims, schema-registry, retrieval orchestrator, compaction worker. |
| `conversational-engine` | `audit-memory`, `llm-provider` | Question generator, attribution, adaptive evolution, NC drafter, coverage tracker, question library. |
| `llm-provider` | — | OllamaProvider, VllmProvider, LlamaCppProvider, AnthropicProvider, OpenAIProvider, tier router, invocation ledger. |
| `llm-cloud` | `llm-provider` | Cloud-specific provider implementations. |
| `llm-local` | `llm-provider` | Local provider implementations. |
| `probe-engine` | `db` | Probe definition schema, sandboxed runner, result format, probe catalogue loader. |
| `report-engine` | `db`, `signing` | DOCX template rendering, PDF/A-3 conversion, VeraPDF validation, evidence annex builder. |
| `signing` | — | Ed25519 sign/verify, JCS canonicalization, TSA client, SoftwareSigningProvider + KMS interface. |
| `tsa` | — | RFC 3161 timestamp request/response parsing. |
| `working-papers` | `db` | Working paper state machine, Y.Doc shape definitions, finalize/submit flows. |
| `evidence-vault` | `db` | MinIO/S3 client, presign, finalize, chain-of-custody tracking. |
| `vlm-extraction` | `llm-provider` | gRPC client for vlm-py; schema-constrained extraction orchestration. |
| `transcription` | — | gRPC client for transcription-py; WhisperX result parsing. |
| `diarization` | — | Pyannote 3.1 speaker label parsing; participant mapping. |
| `findings` | `db` | Formal finding state machine; candidate-finding promotion/dismissal. |
| `capa` | `db` | CAPA record lifecycle; verification tracking. |
| `peer-review` | `db` | Peer review task lifecycle; comment threading. |
| `qa-checklist` | `db` | QA gate checks; override recording. |
| `sampling` | `db` | Attribute/variable/stratified/judgmental sample draw; seed-stable PRNG. |
| `coverage-dashboards` | `db` | Coverage matrix computation; readiness/audit dashboard data. |
| `search` | Meilisearch, `db` (pgvector) | Hybrid search (keyword RRF + semantic). |
| `interviews` | `db`, `conversational-engine` | Interview session management; transcript storage. |
| `live-interview` | `interviews`, `transcription`, `diarization` | Live session orchestration; coverage delta streaming. |
| `engagement` | `db` | Engagement lifecycle state machine. |
| `tenancy-core` | `db` | Tenant provisioning; RLS session var helpers. |
| `billing` | `db` | Billing records; subscription tier validation. |
| `observability` | — | OTEL setup; structured logging (Pino). |
| `consent-registry` | `db`, `signing` | Consent record storage; signing; ledger anchoring. |
| `cross-engagement-memory` | `audit-memory` | Anonymized cross-engagement pattern aggregation (Phase 15). |
| `cross-framework` | `db` | ISO 42001 ↔ NIST AI RMF ↔ EU AI Act ↔ ISO 27001 mapping tables. |
| `risks` | `db` | Risk register; likelihood/impact matrix. |
| `soa` | `db` | Statement of Applicability lifecycle. |
| `surveillance` | `db`, `engagement` | Surveillance engagement management; client timeline. |
| `archive` | `db` | Engagement archival; cold-storage transitions. |
| `co-auditor` | `db`, `auth-core` | Co-auditor invitation; role assignment. |
| `ai-system-profiler` | `db` | AI System Inventory; AuditForge self-profile. |
| `mcp-tools` | `auth-core`, `signing` | MCP tool registry; per-tool RBAC; receipt writer. |
| `nc-drafter` | `conversational-engine` | Parallel NC drafting sub-engine. |
| `interview-library` | `db` | Question library catalogue; library question CRUD. |
| `catalogues` | `db` | ISO 42001 clause and Annex A catalogues; probe catalogue. |
| `test-helpers` | — | Vitest fixtures, factory functions, fake signing providers. |
| `trace-analyzer` | `db` | OTel / Langfuse trace ingestion; timeline analysis. |

---

## `services/` (Python gRPC Sidecars)

| Service | Language | Purpose |
|---|---|---|
| `transcription-py` | Python 3.11 | WhisperX + Pyannote 3.1; real-time transcription + diarization |
| `vlm-py` | Python 3.11 | Qwen2.5-VL / DeepSeek-OCR; schema-constrained extraction |
| `probe-runner-py` | Python 3.11 | Wraps garak, PyRIT, HarmBench; runs LLM-specific probes |
| `audit-evidence-runner` | Python 3.11 | Runs evidence file pre-processing (AV scan, format conversion) |

---

## `infra/`

| Directory | Contents |
|---|---|
| `docker-compose.dev.yml` | Full local dev stack |
| `docker-compose.prod.yml` | Single-node prod compose (small deployments) |
| `helm/` | Helm chart for Kubernetes deployment |
| `terraform/` | Terraform modules for AWS/Azure/GCP infra provisioning |
| `observability/` | Prometheus config, Grafana dashboards, Alertmanager rules |
| `postgres-init/` | DB init scripts (extension creation, RLS bootstrap) |
| `runbooks/` | Operator runbook markdown files |
| `grafana/` | Grafana dashboard JSON sources |

---

## Cross-References

- [ADR-0001](../adr/0001-modular-monolith.md) — why NestJS modular
  monolith.
- [03-tech-stack.md](03-tech-stack.md) — technology decisions.
- [06-adding-a-new-domain.md](06-adding-a-new-domain.md) — adding a new
  module.
