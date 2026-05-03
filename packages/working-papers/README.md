# @auditforge/working-papers

Working paper domain, CRDT sync, templates, verdict state machine, conflict reconciliation, and cross-WP search interfaces for the AuditForge ISO 42001 lead-auditor workbench.

License: BUSL-1.1.

## Scope

This package implements Section 3.4 (Working Papers) and the working-paper portion of Phase 4 of the design (`auditforge.md`). It is purely a domain library — transports, persistence, and HTTP plumbing live in `apps/api` and `apps/worker`. ADR-0004 chose Yjs as the CRDT backbone; this package exposes a transport-agnostic Provider interface so the API can plug `y-websocket` or Hocuspocus.

## Modules

- `domain/` — `WorkingPaper`, `WpObservation`, `WpEvidenceLink`, `WpTemplate` types + Zod schemas
- `verdict/` — verdict state machine (allowed transitions, reason-note rules)
- `templates/` — template registry, variable substitution, customization per CB
- `crdt/` — Yjs document factory, snapshot/encode helpers, Provider interface
- `conflict/` — conflict reconciliation for non-mergeable fields (verdict, confidence)
- `sync/` — offline sync delta computation
- `search/` — `SearchIndexer` adapter interface (Meilisearch + pgvector hybrid) and cross-WP search query API
- `registry/` — `WorkingPaperRegistry` CRUD with tenancy enforcement and audit-ledger emit hooks
- `ledger/` — outbound ledger event types

## Templates

Thirty-plus JSON templates ship in `templates/`:

- `clauses/` — base templates per ISO 42001 clause (4–10)
- `annex-a/` — per-Annex-A control templates (A.2–A.10 families)
- `ai-systems/` — per-AI-system-type templates (LLM, predictive ML, agent, RAG, multi-agent workflow, training pipeline)

Each template contains:

- `sections[]` — narrative section scaffolds with `prompts[]`
- `checklists[]` — yes/no/na items
- `suggestedEvidenceTypes[]`
- `suggestedProbes[]`
- `suggestedInterviewQuestions[]`
- `mappedClauses[]` and `mappedControls[]`
- `appliesTo` — clause / control / aiSystemType

## Yjs adapter

`createWorkingPaperDoc` returns a fresh `Y.Doc` with the canonical shape:

- `meta` — `Y.Map` (verdict, confidence, lastEditedAt, authorId)
- `body` — `Y.XmlFragment` (rich text)
- `checklists` — `Y.Array<Y.Map>`
- `observations` — `Y.Array<Y.Map>`
- `evidence` — `Y.Array<Y.Map>` (links, polymorphic ref)

`encodeSnapshot` / `applySnapshot` use `y-protocols/sync` for cross-replica
state transfer. The provider interface is transport-agnostic so the API can
wire `y-websocket`, Hocuspocus, or in-process pumps.

## Verdict state machine

Verdicts: `conformant | minor_nc | major_nc | ofi | na`. Transitions are
restricted; certain transitions (e.g., demoting `conformant -> minor_nc`)
require a reason note and emit a ledger event.

## Cross-tenant guarantees

Every registry operation is scoped to a `TenantContext`. Cross-tenant
retrieval and edit attempts raise `TenantViolation`.
