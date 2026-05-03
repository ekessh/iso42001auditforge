# ADR-0008: First-Class Cross-Framework Mapping (42001 ↔ EU AI Act ↔ NIST AI RMF ↔ ISO 23894 ↔ ISO 5338)

- **Status**: Accepted
- **Date**: 2026-05-03
- **Phase**: 0, 8
- **Tags**: cross-framework, data-model

## Context

Lead auditors regularly need to demonstrate that an audit covers obligations under multiple frameworks. Generic GRC tools treat each framework as a silo, forcing duplicate evidence work. We can deliver a unified audit that emits multi-framework conformity views — but only if mapping is a first-class data structure, not a spreadsheet.

## Decision

Mapping is a directed graph stored in `framework_mappings` with edges typed by relationship strength: `equivalent`, `subsumes`, `supports`, `partial`, `referenced_by`. Source nodes include ISO 42001 clauses, Annex A controls, EU AI Act articles, NIST AI RMF subcategories, ISO 23894 risk treatments, and ISO 5338 lifecycle activities. Each mapping carries a confidence score, an SME signoff, a rationale, and a citation.

Working papers, findings, and report sections may attach to the source node and project to mapped nodes for cross-framework reports.

Mappings are seeded by SMEs and curated; the data lives in the repo as JSON for review and diff.

## Consequences

### Positive
- One audit → multiple framework reports.
- SME-curated mappings are version-controlled and reviewable.

### Negative
- Mapping maintenance is ongoing; standards evolve.
- Confidence scoring requires governance.

### Neutral
- Data structure is open; specific curated mapping packs may be paid add-ons later.

## Alternatives Considered

| Option | Why rejected |
|--------|--------------|
| Spreadsheet of mappings | Not queryable, not versioned. |
| Separate audit per framework | Defeats the purpose; auditees won't pay 3×. |
| LLM-generated mappings only | Insufficient for compliance use without SME signoff. |

## Compliance Implications

ISO 42001, EU AI Act, NIST AI RMF, ISO 23894, ISO 5338.

## Follow-Ups

- [ ] Mapping JSON schema.
- [ ] Curation workflow + governance.
- [ ] Cross-framework annex template.
