# ADR-0010: Schema-Constrained LLM Extraction (No Free-Form Entity Types)

- **Status**: Accepted
- **Date**: 2026-05-03
- **Phase**: 7.5
- **Tags**: llm, memory, extraction, hallucination

## Context

The Conversational Audit Engine extracts atomic claims from auditee answers and resolves entity references. If the LLM is allowed to invent entity types and relation types freely, the claim graph degenerates into noise inside a few hundred entries — the canonical failure mode of every "knowledge graph from LLM extraction" project.

## Decision

Pre-declare a fixed set of entity types (`AISystem`, `Auditee`, `AuditorClaim`, `Process`, `Control`, `Evidence`, `Stakeholder`, `DataFlow`, `Risk`, `Incident`, `Tool`, `Vendor`, `Dataset`, `Model`, `AgentWorkflow`) and relation types (`covers`, `evidences`, `contradicts`, `supersedes`, `applies_to`, `owned_by`, `processes`, `feeds`, `monitors`, `reviews`, `escalates_to`, `depends_on`). Versioned per engagement.

Extraction calls go through grammar-constrained decoding (llama.cpp grammars for local providers, `instructor` / `outlines` for cloud providers, JSON schema enforcement). Outputs that fail schema validation are logged in `extraction_invocations` but not stored as claims.

Auditors can request a new entity or relation type via an explicit governance step that creates a new schema version; existing claims keep referencing their original schema version.

## Consequences

### Positive
- Bounded vocabulary; reasoning over the graph stays tractable.
- Hallucinated entities cannot enter persistent state.
- Clause IDs from the catalog are likewise constrained: re-ranker outputs only valid IDs (probe P-AF-CLAUSE-01 enforces).

### Negative
- Some auditee statements don't fit any current entity type. They get logged as schema-failure rather than captured. We tune the schema as we learn.
- Adds a per-call schema-validation step (cheap, but non-zero).

### Neutral
- Entity type list is itself versioned. Engagement is tied to its declared schema version.

## Alternatives Considered

| Option | Why rejected |
|---|---|
| Free-form extraction with post-hoc clustering | Drift unbounded; auditor cannot reason about the graph; failed in three published experiments. |
| Soft validation (LLM judges its own output) | Recursive trust issue; not defensible in audit. |
| No structured extraction (raw text only) | Defeats the purpose of the memory layer. |

## Compliance Implications

ISO 17021-1 evidence integrity: extraction is reproducible and auditable. Schema versions are part of the audit ledger.

## Follow-Ups

- [ ] Quarterly schema review with external lead auditors.
- [ ] Probe P-AF-CLAUSE-01 in CI.
- [ ] `extraction_invocations` retention policy.
