# ADR-0019: Hybrid search via Meilisearch + pgvector with Reciprocal Rank Fusion

- **Status**: Accepted
- **Date**: 2026-05-10
- **Deciders**: AuditForge core, search lead
- **Phase**: 7 (data layer) → 7.5 (memory layer)
- **Tags**: search, retrieval, vector, lexical, fusion

## Context

ISO 42001 audit work is heavily textual: clause libraries, evidence
artefacts, working-paper notes, interview transcripts, candidate findings.
The retrieval requirements are mixed:

- **Lexical / exact**: "find every working paper that cites clause 6.2.1"
  needs exact substring + token matches; embeddings will under-rank a
  document that says "6.2.1" once but is otherwise off-topic.
- **Semantic**: "show evidence about model card incompleteness" must
  retrieve documents that never use those exact words.
- **Hybrid**: most real auditor queries blend both ("our policy on data
  governance, focus on clause 6.2.4").

Wave-1 / Wave-2 wired Meilisearch (lexical) and pgvector (semantic) and
needed to define how to combine results.

## Decision

Run both backends in parallel and combine results with **Reciprocal Rank
Fusion (RRF)** (Cormack/Clarke/Buettcher 2009):

```
score(d) = sum_over_engines( 1 / (k + rank_engine(d)) )
```

with `k = 60` (the constant used in the canonical RRF paper, robust across
domains). The engines do not need to score-normalize; only ranks matter.

Meilisearch and pgvector queries fire concurrently; the API merges, sorts
by RRF score, applies tenant RLS filters in a final pass, and returns the
top-N. The implementation lives in `packages/search/src/hybrid.ts`.

ADR-0019 supersedes the partial coverage in ADRs 0014 and 0015 (which
dealt with Tauri and PWA wiring respectively, not search) and consolidates
the search-fusion decision in one place.

## Consequences

### Positive

- **No tuning of score scales.** RRF is rank-only, so re-indexing one
  engine cannot accidentally dominate the other.
- **Robust to engine outages.** If Meilisearch is down, RRF degrades to a
  pure-vector search; if pgvector is slow, the API can short-circuit on
  the lexical results.
- **Auditable.** Every search response carries the per-engine rank for
  each document, exposed in the developer "explain" panel.

### Negative

- **Two indices to maintain.** Reindex jobs run for both backends on
  every update; we accept the storage and write-amplification cost.
- **No learned ranker.** A learning-to-rank model would likely beat RRF
  by a few points on user queries, but training data and label policy
  are out of scope for v3.

### Neutral

- We considered ColBERT-style late-interaction retrieval. It would
  collapse the two-engine architecture but requires a GPU at query time
  and a custom index; deferred to a future ADR.

## Alternatives Considered

| Option | Why rejected |
|--------|--------------|
| Pure pgvector | Misses exact clause-id queries unless queries are tokenized identically — fragile. |
| Pure Meilisearch | No semantic recall on paraphrased questions. |
| Linear score fusion | Requires score normalization; brittle when index sizes diverge. |
| Cross-encoder re-rank only | Adds GPU latency to every query; deferred to "reasoning tier" use cases. |

## Compliance Implications

- **ISO 42001 Clause 7.5** (documented information): hybrid search must
  return all evidence whose clause references match the query, even when
  paraphrased; RRF gives a defensible recall floor.
- **ISO 17021-1 Clause 9.4** (audit programme management): RRF results
  feed the coverage dashboard; the dashboard methodology is logged in
  the audit ledger so a peer reviewer can replay the search.

## Follow-Ups

- [ ] Phase 8: index integrity check — for every document in Postgres,
      assert it appears in both Meilisearch and pgvector indices, and
      that the embeddings are within tolerance of the embedder's
      currently-active model hash.
- [ ] Phase 8: add `k` (RRF constant) to engagement-level configuration
      so per-engagement A/B testing is possible.
- [ ] Phase 9: cross-encoder re-ranker for the top-50 RRF results
      ("medium" tier in ADR-0011 LLM provider abstraction).
