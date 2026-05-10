# ADR-0026: Bi-temporal claim graph in Postgres only (no Neo4j)

- **Status**: Accepted (refines ADR-0009)
- **Date**: 2026-05-10
- **Deciders**: AuditForge core, audit-memory lead
- **Phase**: 7.5 (audit memory layer)
- **Tags**: data-model, temporal, graph, postgres, no-neo4j

## Context

ADR-0009 chose a bi-temporal claim graph (event_time + ingestion_time;
old claims invalidated, never deleted) for the audit memory layer.
`CLAUDE.md` is explicit: "Postgres-only (no Neo4j). pgvector + recursive
CTEs + adjacency tables." Wave-1 / Wave-2 had to land the schema and
the query primitives before the conversational engine could rely on
them.

The decision has two halves:

1. **Why no graph database?**
2. **How do we get acceptable graph-traversal performance from
   Postgres?**

## Decision

### Half 1 — no Neo4j

We keep the entire claim graph in Postgres because:

- **One trust boundary.** RLS policies (ADR-0017), the audit ledger
  (ADR-0020), and the claim graph all share a single Postgres instance.
  Splitting to Neo4j would mean (a) duplicating RLS in Cypher
  (Neo4j's auth model is role-based, not row-based), (b) cross-DB
  consistency between ledger writes and graph writes (ADR-0021's
  outbox is intra-Postgres), and (c) two backups, two failovers.
- **Bi-temporal queries are SQL-natural.** The two timelines map to
  two range columns (`event_time tstzrange`, `ingestion_time tstzrange`);
  GiST indexes handle them efficiently.
- **Graph depth is shallow.** Claim graphs have 3-5-hop traversals at
  most (claim → entity → claim → entity); recursive CTEs handle this
  in well under 100 ms on realistic data.
- **Operational simplicity.** One operator skill set (Postgres) instead
  of two.

### Half 2 — schema and query primitives

The schema lives in `packages/audit-memory/src/schema/claim-graph.ts`:

- `entities(id, engagement_id, type, canonical_name, attributes_jsonb)`
- `claims(id, engagement_id, predicate, subject_entity_id,
  object_value_jsonb, source_episode_id, event_time tstzrange,
  ingestion_time tstzrange, confidence, llm_invocation_id)`
- `claim_relations(parent_claim_id, child_claim_id, relation_type)`
- `entity_neighbours_mat` (materialized view, refreshed nightly + on
  demand) — adjacency closure to depth 3 for the hot read path.

The query primitives are exposed by `RetrievalOrchestrator`:

- `claimsAt(engagementId, entityId, asOf)` — bi-temporal point-in-time.
- `walk(engagementId, startEntityId, depth, predicateFilter)` —
  recursive CTE with depth cap.
- `invalidate(claimId, supersededBy?)` — closes the ingestion-time
  range; old claim is **invalidated, never deleted**.

All claim writes are pre-declared per engagement via a
`schema_registry` table (entity types, relation types, allowed
predicates). The LLM extractor's output is zod-validated against the
registry before insert; an unknown predicate is a structured error,
not a row.

## Consequences

### Positive

- **One trust boundary, one backup, one DR plan.**
- **RLS extends naturally** — the same `firm_id` / `engagement_id`
  session vars (ADR-0017) gate the claim graph for free.
- **Bi-temporal correctness is testable.** Wave-3 e2e includes the
  case "edit a claim today, query it as of yesterday" and asserts the
  prior version is returned.

### Negative

- **No graph algorithms.** PageRank-on-claims, community detection
  etc. are not in scope; recursive CTEs handle the traversal queries
  we have.
- **Materialized view freshness.** Depth-3 adjacency closure can lag
  by up to 5 minutes; we accept this for read-heavy retrieval.

### Neutral

- We considered Apache AGE (Postgres extension giving openCypher).
  It is interesting but immature; we stayed with vanilla SQL +
  recursive CTEs.

## Alternatives Considered

| Option | Why rejected |
|--------|--------------|
| Neo4j + Postgres dual store | Two trust boundaries, dual-write problem, extra ops. |
| In-memory graph (Apache TinkerPop) | Loses durability; loses RLS. |
| Apache AGE | Immature; openCypher dialect drift; not worth the risk. |
| ArangoDB / multi-model DB | Yet another operator skill set. |

## Compliance Implications

- **ISO 42001 Clause 7.5** (documented information): bi-temporal
  semantics preserve the *historical record* of every claim, with the
  ingestion timeline reconstructable.
- **ISO 17021-1 Clause 9.4** (audit programme): "what did we know and
  when did we know it" is answerable by querying as-of the audit
  date.
- **EU AI Act Art. 12** (record-keeping): immutable history of model
  outputs that fed the graph is traceable through `llm_invocation_id`
  on every claim.

## Follow-Ups

- [ ] Phase 8: query plan probes — assert recursive CTEs hit the
      right indexes on representative engagement sizes.
- [ ] Phase 8: load test on `claim_graph` writes (`load/ledger-append.js`
      style scenario for memory-layer writes).
- [ ] Phase 15: cross-engagement read mode (Phase 15 deliverable) layers
      a per-engagement RLS exception flow on top of this schema.
