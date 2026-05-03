# Conversational Engine Corpus

Synthetic + (eventually) real-world labeled corpus for the AuditForge Conversational Audit Engine. Runs as the v3 Phase 14 launch gate (per `v3.md` Section 15.9 + 18.5). License: BUSL-1.1.

## Status

This bootstrap (`synthetic-bootstrap.json`) ships **50 synthetic, anonymized auditee answers** covering all 9 Annex A control families. It is sufficient for CI gating during early development; the full corpus (300–500 labeled answers per real lead auditors) lands during Phase 7.6 / 7.7 and is stored in `commercial/eval-corpus/` per Section 15.9.

## Coverage

All entries map to one or more clauses in:

- ISO 42001 mandatory clauses 4–10
- Annex A control families A.2 through A.10

Each Annex A family appears at least 5 times across the bootstrap. Audit phases (`S1`, `S2`, `Surv`, `Recert`, `Special`, `Readiness`) and AI system kinds (`llm`, `predictive-ml`, `agent`, `rag_agent`, `multi-agent`, `training-pipeline`, `mcp-server`, `vector-db`) are spread across the entries so per-segment metrics can be computed.

## Schema

```json
{
  "id": "C-001",
  "answer": "<auditee answer text, anonymized>",
  "ground_truth": {
    "claims": [
      { "subject": "...", "predicate": "...", "object": "..." }
    ],
    "primary_attributions": [
      { "framework": "ISO42001_AnnexA", "nodeId": "A.7.4", "confidence": 0.95 }
    ],
    "supporting_attributions": [
      { "framework": "ISO42001", "nodeId": "9.1", "confidence": 0.5 }
    ],
    "dismissed_false_positives": [
      { "framework": "ISO42001_AnnexA", "nodeId": "A.6.2.5", "rationale": "Looks similar but unrelated to deployment runbook" }
    ],
    "contradicts": null
  },
  "audit_phase": "S2",
  "ai_system_kind": "rag_agent",
  "tags": ["data_quality", "lineage"]
}
```

`contradicts` is either `null` or the id of another corpus entry whose answer is contradicted (used by `contradiction-bench.ts`).

## Frameworks

Attribution `framework` values:

- `ISO42001` — mandatory clauses (e.g. `9.1`, `9.2`)
- `ISO42001_AnnexA` — Annex A controls (e.g. `A.7.4`)

Other frameworks (NIST, OWASP, MIT AI Risk) appear in cross-framework mappings but the corpus measures attribution to ISO 42001 only.

## How metrics are computed

| Bench | Metric |
|-------|--------|
| `extraction-bench.ts` | precision / recall / F1 of `(subject, predicate, object)` triples vs ground truth |
| `attribution-bench.ts` | precision@k, recall@k per Annex A family for `k in {1, 3, 5}` |
| `contradiction-bench.ts` | precision / recall of contradiction pair detection |
| `release-gate.ts` | runs all three; fails CI if any metric drops >5% vs `baseline.json` |

## Updating the baseline

```
pnpm --filter @auditforge/conversational-corpus bench:release-gate:update-baseline
```

Updates `baseline.json` with current scores. PRs that bump the baseline must call this out in the description; reviewers should verify the new baseline isn't masking regressions.
