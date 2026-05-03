# AuditForge ISO 42001 — Build Guide

## Mission
Exclusive workbench for ISO/IEC 42001 Lead Auditors to perform end-to-end audits
of AI Models, AI Agents, and Agentic Workflows.
NOT a tool for auditees. Auditor's tool only.

## Legal
Clean-room implementation. Do NOT read or copy from other audit-tool source.
Sources: ISO 42001 standard, ISO 17021-1, IAF MD docs, NIST AI RMF, EU AI Act,
OWASP LLM Top 10, MITRE ATLAS, AVID, MIT AI Risk Repo, this design doc.

## License Model — Business Source License 1.1
- All source under BUSL-1.1. See LICENSE.
- Every source file MUST carry `SPDX-License-Identifier: BUSL-1.1`.
- Production use permitted with the Additional Use Grant exclusion (no
  competing hosted/embedded certification, audit-management, or AI-governance
  service).
- Converts to Apache-2.0 on the Change Date (4 years per release).

## Phase
Phase 0–14 in progress. Update each session.

## Stack
- Monorepo: pnpm workspaces
- Web: Next.js 15 + Tailwind + shadcn/ui + TanStack Query + Zustand
- Desktop: Tauri 2
- Mobile: PWA
- API: NestJS modular monolith (or Hono+TS)
- ORM: Drizzle
- DB: Postgres 16 + pgvector + RLS
- Cache/Queue: Redis 7 + BullMQ
- Sync: Yjs CRDT
- Storage: MinIO/S3
- Search: Meilisearch + pgvector
- Auth: Auth.js + WebAuthn
- LLM cloud: Anthropic + OpenAI SDK (opt-in per engagement)
- LLM local: Ollama + vLLM (default)
- Tests: Vitest + Playwright + k6 + Semgrep + ZAP

## Conventions
- Conventional Commits
- TypeScript strict mode
- Drizzle schema-first
- Postgres RLS for tenant isolation (defense in depth + app guards)
- Event sourcing for audit ledger (signed, hash-chained, TSA)
- Local-LLM default; cloud LLM opt-in per engagement
- Offline-first for working papers
- 85% unit coverage / 80% branch
- ADR for cross-cutting changes
- WCAG 2.2 AA accessibility

## Per-PR Gates
1. 2 reviewers (1 senior; +1 security for sensitive)
2. Lint + typecheck clean
3. Unit + integration tests pass
4. No new SAST/SCA findings
5. No secrets
6. OpenAPI updated for API changes
7. SPDX header on every new source file
8. DCO sign-off on every commit (`-s`)

## Per-Phase Gates
1. Architecture review (ADR updated)
2. Security review (threat model delta)
3. Performance review (load test)
4. Compliance review (where applicable)
5. Documentation updated

## Working Style
- Modular monolith — respect package boundaries
- Don't introduce microservices prematurely
- Prefer editing existing files
- No comments unless WHY is non-obvious
