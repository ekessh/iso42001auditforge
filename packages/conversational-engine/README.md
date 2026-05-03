# @auditforge/conversational-engine

> v3 Phase 7.6 — Conversational Audit Engine for ISO/IEC 42001 lead auditors.

License: BUSL-1.1

## Surface area

- **Question Library** (`./question-library`) — JSON-backed, Zod-validated. 60+
  questions covering ISO 42001 clauses 4–10 and Annex A.2–A.10, with applicable
  AI system kinds (LLM, predictive ML, agent, RAG, multi-agent, training
  pipeline, MCP server, vector DB) and pre-authored follow-ups. External lead
  auditors can review changes via a single JSON diff.
- **Question Generator** (`./question-generator`) — deterministic
  scope-resolution → library-retrieval → coverage-prioritization →
  contextualization (LLM, optional, never invents) → follow-up assembly. Output
  carries full provenance.
- **Answer Attribution Engine** (`./attribution`) — 8-step pipeline (episode
  write → claim extraction → hybrid retrieval → re-rank → contradiction check
  → coverage update → auditor review bundle → working-paper linkage). Hard
  hallucination guard: re-ranker output is filtered against the injected clause
  catalog (probe `P-AF-CLAUSE-01`).
- **Coverage Tracker** (`./coverage-tracker`) — bi-temporal coverage state with
  full transition history; emits an `areaCovered` event when an area's clauses
  are fully evidenced or N/A.
- **Drizzle schema slice** (`./db/schema`) — `question_library`,
  `question_library_versions`, `question_followups`, `question_invocations`,
  `question_decisions`, `coverage_state`, `coverage_state_history`.

## Hard rules

1. The LLM never invents a question. Library text or pre-authored follow-up
   only.
2. The re-ranker only emits valid clause IDs from the injected catalog.
   Non-matching IDs are dropped and logged. CI probe `P-AF-CLAUSE-01` enforces.
3. Engine outputs are drafts. Auditor confirmation is the only state-transition
   trigger.
4. Provider switching does not invalidate prior auditor decisions; decisions
   are model-independent at the audit-record level.

## Notes for downstream wiring

- This package depends on a minimal local interface shim for
  `@auditforge/audit-memory` and `@auditforge/llm-provider`. When those
  packages are filled in (Phase 7.5), follow the
  `TODO(phase-7.5)` markers and switch the imports.
- All evidence persistence to working papers goes through
  `@auditforge/working-papers` (interface only here).
