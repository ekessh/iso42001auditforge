<!--
SPDX-License-Identifier: BUSL-1.1
-->
<!-- metadata
section: developer-guide
audience: contributor
cross-refs:
  - docs/adr/
  - docs/developer-guide/02-monorepo-tour.md
-->

# Tech Stack

> Technology decisions and the ADRs that justify them. Read the ADR
> before questioning a technology choice — the rationale is already
> documented.

---

## Summary Table

| Layer | Technology | Version | ADR |
|---|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | pnpm 9, Turborepo 2 | — |
| Web | Next.js, Tailwind CSS, shadcn/ui, TanStack Query, Zustand | Next.js 15 | [ADR-0018](../adr/0018-zustand-auth-store-localstorage-interim.md) |
| Desktop | Tauri | 2.x | [ADR-0014](../adr/0014-tauri-desktop.md) |
| Mobile | PWA | Next.js 15 | [ADR-0015](../adr/0015-pwa-mobile.md) |
| API | NestJS modular monolith | NestJS 10 | [ADR-0001](../adr/0001-modular-monolith.md) |
| ORM | Drizzle | 0.x | [ADR-0017](../adr/0017-drizzle-orm-and-rls-session-vars.md) |
| Database | Postgres 16 + pgvector + RLS | PG 16 | [ADR-0003](../adr/0003-postgres-rls-tenancy.md), [ADR-0026](../adr/0026-bi-temporal-claim-graph-postgres.md) |
| Queue | BullMQ (Redis 7) | BullMQ 5 | — |
| CRDT sync | Yjs + y-websocket + y-indexeddb | Yjs 13 | [ADR-0023](../adr/0023-yjs-y-websocket-rbac-indexeddb.md) |
| Search | Meilisearch + pgvector (hybrid RRF) | Meili 1.7 | [ADR-0019](../adr/0019-hybrid-search-meili-pgvector-rrf.md) |
| Object storage | MinIO / S3-compatible | MinIO RELEASE.2024 | — |
| Auth | Auth.js + WebAuthn (FIDO2) | — | — |
| LLM local | Ollama / vLLM / llama.cpp | — | [ADR-0005](../adr/0005-local-llm-default.md) |
| LLM cloud | Anthropic SDK, OpenAI SDK | — | [ADR-0025](../adr/0025-airgap-cloud-consent-guard.md) |
| LLM abstraction | Custom `packages/llm-provider` | — | [ADR-0011](../adr/0011-llm-provider-abstraction.md) |
| Signing | Ed25519 (RFC 8032) + RFC 3161 TSA | — | [ADR-0020](../adr/0020-hash-chained-ledger-ed25519-tsa.md) |
| PDF | LibreOffice + VeraPDF (PDF/A-3) | — | [ADR-0022](../adr/0022-pdfa-self-rolled-verapdf.md) |
| Audit ledger | Event sourcing, hash chain | — | [ADR-0002](../adr/0002-event-sourced-audit-ledger.md) |
| Claim graph | Bi-temporal, Postgres + pgvector | — | [ADR-0009](../adr/0009-bi-temporal-claim-graph.md) |
| Transcription | WhisperX + Pyannote 3.1 | — | — |
| VLM extraction | Qwen2.5-VL / DeepSeek-OCR | — | — |
| MCP | Model Context Protocol SDK | — | [ADR-0016](../adr/0016-mcp-server-scaffold.md) |
| Tests | Vitest, Playwright, k6, Semgrep | — | — |
| Observability | OpenTelemetry, Pino, Prometheus, Grafana | — | — |
| CSP | Per-request nonces (Next.js middleware) | — | [ADR-0027](../adr/0027-csp-relaxation-netlify-interim.md) |

---

## Why TypeScript Strict Mode

CLAUDE.md mandates strict mode. Every package has `"strict": true` in
its `tsconfig.json` (extending `tsconfig.base.json` at the root).

Strict mode catches:

- Implicit `any` — forces explicit types on LLM output handling.
- Null dereferences — critical in the ledger write path.
- Unused variables — noise reduction.

Type errors block CI via `pnpm typecheck`.

---

## Why No Microservices (Yet)

See [ADR-0001](../adr/0001-modular-monolith.md). The short answer: a
small team cannot afford the distributed transaction complexity, cross-
service observability investment, and tenancy enforcement duplication
that microservices require. We split when the team reaches ≥ 10
engineers or a module has a clearly divergent scaling profile.

---

## Cross-References

- All [ADRs](../adr/) — individual technology decisions.
- [02-monorepo-tour.md](02-monorepo-tour.md) — where each technology
  is used.
