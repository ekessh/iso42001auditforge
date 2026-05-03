# ADR-0009: Bi-Temporal Claim Graph in Postgres (No Neo4j)

- **Status**: Accepted
- **Date**: 2026-05-03
- **Phase**: 7.5
- **Tags**: memory, graph, postgres, audit-integrity

## Context

The v3 Audit Memory Layer needs a structured store of atomic claims, traversable like a graph (claim → contradicts → claim, claim → covers → clause). Auditors must reconstruct "what did I know when I made this judgment, and when did the picture change?" This is bi-temporal: validity (when the auditee says the fact became true) versus ingestion (when we recorded it). Naïve options pushed us toward Neo4j or Graphiti.

## Decision

Store the claim graph in Postgres only. Use `pgvector` for semantic retrieval, `pg_trgm` + Postgres FTS for lexical retrieval, recursive CTEs for graph traversal, and properly indexed adjacency tables (`claim_relations`) for explicit edges. No Neo4j, no Graphiti, no external graph DB.

Bi-temporal model: every claim row carries `event_time_start`, `event_time_end`, `ingestion_time`. Corrections invalidate prior rows by setting `event_time_end`; rows are never deleted. Coverage state and attributions inherit the same model.

## Consequences

### Positive
- One operational dependency, not two. Backups, RLS, partitioning, observability are uniform.
- Cross-cutting transactions (claim + attribution + coverage update) are atomic.
- Auditor reconstruction queries become "AS OF" CTEs against a single store.
- Tenancy enforcement uses the same RLS policies that already protect the rest of the system.

### Negative
- Recursive CTE traversal is slower than purpose-built graph engines at billions of edges. We are at 10k–100k claims per engagement, not billions.
- Graph algorithms beyond reachability (shortest path with weights, community detection) are awkward in SQL.

### Neutral
- pg_partman partitions claim tables by engagement.
- Materialized views handle hot retrieval paths.

## Alternatives Considered

| Option | Why rejected |
|---|---|
| Neo4j | Operational cost; second backup story; no native multi-tenant RLS; cross-system transaction headache. |
| Graphiti / FalkorDB | Same drawbacks plus immature ops tooling. |
| Triplestore (RDF/SPARQL) | Tooling fragmentation; auditor-defensibility story weaker. |

## Compliance Implications

ISO 17021-1 evidence integrity: bi-temporal model preserves "what we knew when." GDPR Art. 17 erasure: per-engagement encryption keys allow crypto-shredding without breaking immutability of other engagements.

## Follow-Ups

- [ ] Bench retrieval p95 at 100k claims with recursive CTEs.
- [ ] Define partitioning strategy.
- [ ] Materialized-view refresh cadence.
