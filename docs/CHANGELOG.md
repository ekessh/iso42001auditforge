<!--
SPDX-License-Identifier: BUSL-1.1
-->

# Changelog

> All notable changes to AuditForge. Format: [Keep a Changelog 1.0.0](https://keepachangelog.com/).
> Versions correspond to development waves. Conventional Commits drive this log.

---

## [Unreleased — Wave 5 / Phases 15–16]

### Added

- Cross-engagement memory: anonymized pattern aggregation across prior
  engagements within the same firm (`packages/cross-engagement-memory`,
  `GET /v1/cross-engagement-memory`).
- MCP server GA: `apps/mcp-server` with 9 registered audit tools, per-tool
  RBAC, Ed25519-signed receipts, and AI system self-profile.
- Comprehensive documentation suite: auditor guide (17 files), operator
  guide (13 files), developer guide (10 files), concepts (9 files), API
  reference (39 files, 167 endpoints), compliance guide (6 files),
  tutorials (5 files).
- API reference auto-generation script (`scripts/build-api-reference.ts`).
- Link validator script (`scripts/validate-doc-links.ts`).
- Mermaid diagram sources (`docs/diagrams/`, 7 diagrams).

---

## [0.14.0 — Wave 4 / Phases 8–14] — 2026-05-10

### Added

- Peer review module: per-finding technical review with comment threading
  and approve/escalate workflow (`packages/peer-review`,
  `GET /v1/peer-review`).
- QA checklist: pre-publication gate with 9 checks and auditor override
  (`packages/qa-checklist`, `POST /v1/qa-checklist/evaluate`).
- CAPA tracking: corrective action lifecycle with verification evidence
  (`packages/capa`, `GET /v1/capa`).
- Sampling planner: attribute/variable/stratified/judgmental methods with
  seed-stable replay (`packages/sampling`, `POST /v1/samples/draw`).
- Surveillance module: post-certification surveillance engagements;
  client timeline view (`packages/surveillance`, `GET /v1/surveillance`).
- Cross-framework mapping: ISO 42001 ↔ NIST AI RMF ↔ EU AI Act ↔ ISO 27001
  (`packages/cross-framework`, `GET /v1/cross-framework`).
- MCP server scaffold: Hono + MCP SDK; tool registry; RBAC; receipt writer
  (`apps/mcp-server`; Phase 15 GA in Wave 5).
- SoA (Statement of Applicability) management (`packages/soa`, `GET /v1/soa`).
- AI System Inventory (`packages/ai-system-profiler`).
- Signing pipeline: Ed25519 + JCS + RFC 3161 TSA; CAdES-LT/PAdES-LTV for
  archival (`packages/signing`, `packages/tsa`).
- PDF/A-3 report rendering with VeraPDF validation (`packages/report-engine`).
- Admin impersonation with time-boxed sessions and ledger anchoring
  (`POST /v1/admin/impersonate`).
- Archive module: cold-storage transitions with evidence retention
  (`packages/archive`, `GET /v1/archive`).
- Billing records module (`packages/billing`, `GET /v1/billing`).

### Changed

- Ledger verifier now supports TSA token validation for `report.publish`
  events (ADR-0020 implementation).

### Fixed

- WebAuthn credential store now uses Drizzle RLS-aware connection (ADR-0003
  compliance).
- AuditorRepository wired to Drizzle (wave 3 gap fix).

### Security

- 16 remaining modules wired to workspace packages with full RLS enforcement.
- Per-request CSP nonces via Next.js middleware (ADR-0027).
- Semgrep rule `ledger-write-without-sign.yml` added to CI.

---

## [0.7.7.0 — Wave 3 / Phases 7.5–7.7] — 2026-05-10

### Added

- Audit Memory Layer: episodes, claims (bi-temporal), claim relations,
  schema-constrained extraction, retrieval orchestrator, compaction worker
  (`packages/audit-memory`; ADR-0009, ADR-0010, ADR-0026).
- LLM Provider Abstraction: OllamaProvider, VllmProvider, LlamaCppProvider,
  AnthropicProvider, OpenAIProvider; tier router; per-invocation ledger
  (`packages/llm-provider`, `packages/llm-cloud`, `packages/llm-local`;
  ADR-0011, ADR-0024).
- Conversational Engine: question generator (library-only; no free-form
  generation), answer attribution with confidence bands, adaptive question
  evolution, parallel NC drafter (`packages/conversational-engine`; ADR-0012).
- Live interview session: WhisperX + Pyannote 3.1 diarization; real-time
  attribution; coverage delta sidebar (`services/transcription-py`,
  `packages/live-interview`, `POST /v1/interviews`).
- VLM evidence extraction: Qwen2.5-VL / DeepSeek-OCR schema-constrained
  extraction (`services/vlm-py`, `packages/vlm-extraction`,
  `POST /v1/evidence-extract`).
- Readiness Mode dashboard (`GET /v1/engagements/{id}/dashboard/readiness`).
- Audit Mode dashboard (`GET /v1/engagements/{id}/dashboard/audit`).
- Cloud LLM consent guard: per-engagement opt-in with written consent
  required; air-gap mode (`packages/consent-registry`; ADR-0025).
- CI probe `P-AF-CLAUSE-01`: re-ranker must emit only valid catalogue clause IDs.
- Storybook with 82 workspace and dashboard stories.

### Changed

- Engine output rule enforced: `AuditLedgerService.emitConfirmed()` requires
  `principalId`; engine pathways cannot write `auditor_confirmed=true`
  without it (ADR-0012).

### Security

- Bi-temporal claim model prevents data loss from corrections (ADR-0009).
- Schema-constrained extraction eliminates free-form LLM output in claim graph
  (ADR-0010, Semgrep rule `free-form-llm-output.yml`).

---

## [0.7.0 — Wave 2 / Phases 6–7] — 2026-05-10

### Added

- Evidence vault: MinIO/S3 encrypted upload, presigned URLs, chain-of-custody
  tracking (`packages/evidence-vault`, `POST /v1/evidence/uploads/presign`).
- Yjs CRDT working papers: y-websocket with per-room RBAC; IndexedDB offline
  persistence; compaction worker (`packages/working-papers`; ADR-0023).
- Meilisearch + pgvector hybrid search: RRF fusion (`packages/search`;
  ADR-0019).
- Tauri 2 desktop app (`apps/desktop`; ADR-0014).
- PWA mobile app (`apps/mobile`; ADR-0015).
- Interview library: curated question set per ISO 42001 clause
  (`packages/interview-library`, `GET /v1/library`).
- Peer review baseline (later extended in Wave 4).
- Risk register (`packages/risks`, `GET /v1/risks`).
- Traces: OTel / Langfuse trace ingestion and timeline analysis
  (`packages/trace-analyzer`, `GET /v1/traces`).

### Changed

- Engagement state machine extended to include `under_review` and `reporting`
  stages.

### Fixed

- y-indexeddb namespace now includes `firmId` to prevent cross-tenant leakage
  on shared devices (ADR-0023 §Offline persistence).

---

## [0.5.0 — Wave 1 / Phases 0–5] — 2026-05-03

### Added

- NestJS modular monolith API with all 37 module directories scaffolded
  (ADR-0001).
- Drizzle ORM with schema-first migrations 0001–0015 and Postgres RLS
  (ADR-0003, ADR-0017).
- Auth.js + WebAuthn (FIDO2) passkey authentication; OIDC support
  (`apps/api/src/modules/identity/`).
- Audit ledger: event sourcing, hash chain, Ed25519 signing
  (`packages/audit-engine`; ADR-0002).
- Probe runner: garak, PyRIT, HarmBench wrappers + native MCP/governance
  probes (`packages/probe-engine`, `services/probe-runner-py`; ADR-0007).
- Engagement lifecycle state machine with Audit Mode / Readiness Mode
  (ADR-0013).
- ISO 42001 clause and Annex A catalogues (`packages/catalogues`).
- Next.js 15 web app with App Router, Tailwind, shadcn/ui, TanStack Query,
  Zustand (`apps/web`).
- BullMQ worker (`apps/worker`).
- Full observability stack: Prometheus, Grafana, Jaeger, Pino, OTEL
  (`packages/observability`, `infra/observability/`).
- Docker Compose dev stack (`infra/docker-compose.dev.yml`).
- Helm chart skeleton (`infra/helm/`).
- Semgrep custom rules (`semgrep/`).
- 27 ADRs covering all major architectural decisions.
- Threat model and security review documents.
- CI pipeline: typecheck, lint, unit/integration/e2e tests, SAST, SCA,
  secrets scan, OpenAPI diff check.
- BUSL-1.1 license; SPDX headers enforced in CI.
- DCO sign-off enforcement.
