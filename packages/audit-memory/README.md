# @auditforge/audit-memory

Bi-temporal claim graph, immutable episode ledger, schema-constrained
extraction, and hybrid retrieval orchestration for the AuditForge
Conversational Audit Engine.

License: BUSL-1.1.

## Scope

- `EpisodeStore` — append-only ledger of raw observations (interview turns,
  auditee answers, evidence uploads, system events).
- `SchemaRegistry` — per-engagement, versioned entity-type and relation-type
  vocabularies.
- `ClaimGraph` — bi-temporal claims (event time + ingestion time), invalidate
  and supersede semantics.
- `ContradictionDetector` — finds claims that contradict on
  `(subject, predicate)` or via explicit edges.
- `HybridRetrievalOrchestrator` — BM25 lexical + pgvector embedding + graph
  traversal merged via Reciprocal Rank Fusion (k=60).
- `CompactionWorker` — runs an injected `ExtractionAdapter` over raw episodes,
  validates against the active SchemaVersion, archives verbose source bodies
  after N days.
- `PointInTimeQuery` — AS-OF projections of the active claim set.

The actual `ExtractionAdapter` implementation lives in
`@auditforge/conversational-engine`; this package only declares the interface.

All services are tenant-scoped. Cross-engagement access raises
`TenantViolation`.

## Drizzle slice

`src/db/schema.ts` exports table definitions:

- `episodes`, `episode_attachments`, `episode_lineage`
- `claims`, `claim_temporal`, `claim_evidence_links`, `claim_relations`
- `claim_attributions`, `claim_attribution_decisions`
- `entity_types`, `relation_types`, `schema_versions`
- `retrieval_invocations`, `extraction_invocations`

All tables carry `firm_id` + `engagement_id`.

## Background

- ADR 0009: Bi-temporal claim graph.
- ADR 0010: Schema-constrained extraction.
- v3.md §26 for full design.
