<!--
SPDX-License-Identifier: BUSL-1.1
-->
<!-- metadata
section: concepts
audience: developer, auditor
adr: 0009, 0010, 0026
cross-refs:
  - docs/adr/0009-bi-temporal-claim-graph.md
  - docs/adr/0010-schema-constrained-extraction.md
  - docs/diagrams/claim-graph-temporal.mmd
-->

# Claim Graph

> This document explains the bi-temporal claim storage model,
> schema-constrained extraction, and the retrieval orchestrator.

---

## What Is a Claim

A claim is an atomic fact extracted from an episode (interview utterance,
evidence file, probe result) that is attributed to an entity and relates
to an ISO 42001 clause. Examples:

- "AIMS has a documented risk treatment plan" (entity: AIMS, relation:
  `has_control`, clause: `6.1.2`)
- "Model accuracy is 94%" (entity: ProductionModel-v2, relation:
  `has_metric`, metric: accuracy, value: 0.94)
- "No training data lineage documentation exists" (entity: TrainingPipeline,
  relation: `lacks_control`, clause: `A.5.2`)

---

## Bi-Temporal Model

Each claim row has two time axes (ADR-0009):

| Column | Meaning |
|---|---|
| `event_time_start` | When the auditee says this fact became true |
| `event_time_end` | When the fact ceased to be true (null if currently valid) |
| `ingestion_time` | When AuditForge recorded the claim |

A **correction** invalidates a prior claim by setting its
`event_time_end` to the correction time and inserting a new claim with
the updated content. Old claims are **never deleted**. This preserves
the "what did we know when" reconstruction that ISO 17021-1 evidence
integrity requires.

AS-OF queries reconstruct the claim graph as it appeared at any point:

```sql
SELECT * FROM claims
WHERE tenant_id = current_setting('app.tenant_id')::uuid
  AND event_time_start <= '2026-05-01'
  AND (event_time_end IS NULL OR event_time_end > '2026-05-01')
  AND ingestion_time <= '2026-05-01';
```

---

## Schema-Constrained Extraction

Claims are not free-form LLM output. The schema registry
(`packages/audit-memory/src/schema-registry.ts`) pre-declares:

- **Entity types**: `AIMS`, `AIModel`, `TrainingPipeline`,
  `DataSource`, `Process`, `Control`, `Role`, `Metric`, `Document`.
- **Relation types**: `has_control`, `lacks_control`, `has_metric`,
  `documented_by`, `governed_by`, `trained_on`, `deployed_in`.

The VLM / small LLM extractor is constrained to output only valid
`(entity_type, relation_type, entity_name, payload)` tuples. Any output
that does not match the schema is rejected before writing to the DB.
This is a hard rule enforced by Semgrep (free-form-llm-output.yml).

---

## Episode Store

The episode store is the immutable source of truth:

| Table | Contents |
|---|---|
| `episodes` | Raw answers, uploaded evidence blobs, probe result payloads |
| `claims` | Derived atomic facts (with bi-temporal columns) |
| `claim_relations` | Explicit edges between claims (`claim_id → claim_id + relation + weight`) |

Claims can be corrected; episodes cannot. If evidence is later found
to be inauthentic, the episode is flagged (not deleted) and the derived
claims are invalidated.

---

## Claim Graph Traversal

The claim graph is traversed using Postgres recursive CTEs. Example:
find all claims that support coverage of a given clause, including
claims that transitively support other supporting claims:

```sql
WITH RECURSIVE support_graph(claim_id, depth) AS (
  SELECT c.id, 0
  FROM claims c
  WHERE c.clause_id = 'ISO42001:6.1.2'
    AND c.auditor_confirmed = true
    AND c.event_time_end IS NULL
  UNION ALL
  SELECT cr.to_claim_id, sg.depth + 1
  FROM claim_relations cr
  JOIN support_graph sg ON sg.claim_id = cr.from_claim_id
  WHERE sg.depth < 5  -- max depth guard
)
SELECT DISTINCT claim_id FROM support_graph;
```

---

## Retrieval Orchestrator

The retrieval orchestrator in `packages/audit-memory/src/retrieval-orchestrator.ts`
combines:

1. **Semantic retrieval** — `pgvector` cosine similarity on claim
   embeddings (BGE-M3 or text-embedding-3-large).
2. **Lexical retrieval** — `pg_trgm` + Postgres FTS.
3. **Graph traversal** — recursive CTE for related claims.
4. **RRF fusion** — Reciprocal Rank Fusion combines all three result sets.

The top-k fused results feed into the attribution engine's re-ranker.

---

## Cross-References

- [../diagrams/claim-graph-temporal.mmd](../diagrams/claim-graph-temporal.mmd)
  — entity-relationship diagram.
- [ADR-0009](../adr/0009-bi-temporal-claim-graph.md) — storage decision.
- [ADR-0010](../adr/0010-schema-constrained-extraction.md) — schema
  constraint rationale.
- `packages/audit-memory/src/` — source code.
