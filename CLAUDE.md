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

## v3 Additions

### Conversational Audit Engine
- Four sub-engines (Question Generator, Answer Attribution, Adaptive Question Evolution, Parallel NC Drafter) + Audit Memory Layer + LLM Provider Abstraction.
- Engine outputs are ALWAYS drafts. Never auto-promote.
- Auditor confirmation is the only state-transition trigger.
- Audit Mode vs Readiness Mode at engagement creation. Cannot switch mid-engagement.
- Engine never concludes conformity; auditor concludes in the signed report.

### Audit Memory Layer
- Postgres-only (no Neo4j). pgvector + recursive CTEs + adjacency tables.
- Bi-temporal claim graph: event_time + ingestion_time. Old claims invalidated, never deleted.
- Schema-constrained extraction. Entity types and relation types pre-declared per engagement.
- Episode store is immutable source of truth (raw answers, uploaded evidence).
- Per-engagement RLS extends to claim graph.

### LLM Provider Abstraction
- Tiered routing: small (extraction, embedding) / medium (attribution re-rank, NC drafting, contextualization) / large (rare synthesis) / reasoning (high-stakes attribution with CoT capture).
- Local default (Ollama / vLLM / llama.cpp). Cloud opt-in per engagement, auditee written consent required, air-gap mode disables cloud at provider layer.
- Every invocation logged: provider, model name, model hash (local) or version string (cloud), temperature, prompt template version, input/output tokens, latency, cost, auditor accept/reject decision.
- `reasonStructured<T>(prompt, schema, opts)` captures full CoT trace; stored in `llm_invocations.reasoning_trace`.

### Per-Phase Gates (Engine-specific)
1. Corpus regression test passes (no metric regression > 5%)
2. Hallucination probe P-AF-CLAUSE-01 passes (re-ranker emits only valid clause IDs)
3. External lead auditor review for any new question library content
4. Bi-temporal query correctness on synthetic test cases
5. Provider parity tests across all implementations
6. Readiness/Audit dashboard methodology audit-ledger logged

### Engine Working Style
- Schema constraints first. Free-form LLM output is a bug.
- Provenance second. Every suggestion shows why + from where (library Q ID, clause ref, coverage rationale, model, prompt template version).
- Confidence third. Bands drive UI behavior (>0.85 auto-link with bulk confirm; 0.6–0.85 explicit single-click; <0.6 opt-in panel).
- Auditor judgment always wins. Engine is backseat navigator, not driver.

### v3 New Packages
- `packages/audit-memory` — episodes, claims, schema-registry, retrieval orchestrator, compaction worker
- `packages/llm-provider` — Ollama, vLLM, llama.cpp, Anthropic, OpenAI providers, tier router, invocation ledger
- `packages/conversational-engine` — question-generator, attribution, adaptive-evolution, nc-drafter, coverage-tracker, question-library
- `apps/mcp-server` — AuditForge as MCP server (post-launch, Phase 15)

### v3 New Phases
- Phase 7.5: Audit Memory Layer + LLM Provider Abstraction
- Phase 7.6: Question Generator + Answer Attribution + Conversational Workspace UI + Live Interview composer (WhisperX + Pyannote 3.1) + VLM evidence extraction (Qwen2.5-VL / DeepSeek-OCR)
- Phase 7.7: Adaptive Question Evolution + Parallel NC Drafter + Readiness/Audit Dashboards + Audit Mode / Readiness Mode termination
- Phase 15: Cross-Engagement Memory + AuditForge as MCP server
- Phase 16: Continuous Engine Improvement Loop

### v3 Probe Library Strategy
- Wrap `garak` (Apache-2.0), `PyRIT` (MIT), `HarmBench` (CAIS) instead of building all 30 probes from scratch.
- Add MCP probe category: P-MCP-01 (Tool Poisoning), P-MCP-02 (server allowlist), P-MCP-03 (audit trail completeness), P-MCP-04 (auth mode), P-MCP-05 (per-tool RBAC), P-MCP-06 (indirect prompt injection via MCP resources), P-MCP-07 (cross-server session isolation), P-MCP-08 (gateway policy enforcement).

### Termination Semantics
- Per-area: all in-scope clauses for the area evidenced or N/A with rationale.
- Per-engagement Audit Mode: scope covered + all candidate findings reviewed (promoted or dismissed). Conclusion summary synthesized; auditor confirms conformity in signed report.
- Per-engagement Readiness Mode: scope covered + candidate NCs CLOSED (CAPA implemented and verified). Output uses "appears ready" language, mandatory non-certification disclaimer.

### Dashboard Calculation (transparent, no black box)
```
overall_readiness = sum(clause_weight * clause_status_score) / sum(clause_weight)
clause_status_score: evidenced=1.0, partial=0.5, contradicted=0.0, untouched=0.0, N/A excluded
clause_weight (default): mandatory clauses 4-10 = 1.5, Annex A in-scope = 1.0, out-of-scope excluded
```
Methodology lives in audit ledger. Weight changes require explicit auditor/admin action and are logged.

### Hard Rules Enforced in Code
- Re-ranker outputs only clause IDs from the catalog. CI probe P-AF-CLAUSE-01 enforces.
- LLM never invents a question; library or follow-up only.
- Candidate findings never visible to auditee. Only formal Findings post-promotion (and post-peer-review where applicable).
- Provider switching does not invalidate prior auditor decisions (decisions are model-independent at the audit-record level).
- AuditForge profiles itself in its own AI System Inventory (eats own dogfood).
