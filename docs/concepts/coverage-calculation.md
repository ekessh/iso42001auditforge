<!--
SPDX-License-Identifier: BUSL-1.1
-->
<!-- metadata
section: concepts
audience: auditor, developer, compliance-officer
cross-refs:
  - CLAUDE.md (formula definition)
  - packages/coverage-dashboards/
  - docs/auditor-guide/11-readiness-vs-audit-mode.md
-->

# Coverage Calculation

> This document specifies the exact formula used to compute the
> overall readiness/coverage score, clause-level status definitions,
> and edge cases.

---

## Formula (CLAUDE.md Canonical Definition)

```
overall_coverage = sum(clause_weight * clause_status_score)
                   / sum(clause_weight)
```

Where:

- `clause_status_score`:
  - `evidenced` = 1.0
  - `partial` = 0.5
  - `contradicted` = 0.0
  - `untouched` = 0.0
  - `N/A` = **excluded from both numerator and denominator**

- `clause_weight`:
  - Mandatory clauses 4–10 = **1.5**
  - Annex A in-scope controls = **1.0**
  - Excluded Annex A controls = **excluded from both**

---

## Clause Status Definitions

| Status | Definition |
|---|---|
| `evidenced` | At least one auditor-confirmed claim maps to this clause with confidence ≥ 0.60, and the coverage rationale for the clause is met (i.e. the required implementation-evidence questions have been answered). |
| `partial` | At least one auditor-confirmed claim maps to this clause, but the coverage rationale is not fully met. |
| `contradicted` | One or more auditor-confirmed claims explicitly contradict the clause requirement (e.g. a claim that `lacking_control` where the clause requires a control). |
| `untouched` | No auditor-confirmed claims map to this clause. |
| `N/A` | Lead auditor has marked the clause as not applicable with a documented rationale. |

---

## Example Calculation

Scope: mandatory clauses 4–10 (7 clauses × 1.5 weight = 10.5) + 5
Annex A controls (5 × 1.0 = 5.0). Total weight = 15.5. One Annex A
control excluded (N/A). Effective denominator = 14.5.

| Clause | Weight | Status | Score | Contribution |
|---|---|---|---|---|
| 4 | 1.5 | evidenced | 1.0 | 1.5 |
| 5 | 1.5 | evidenced | 1.0 | 1.5 |
| 6 | 1.5 | partial | 0.5 | 0.75 |
| 7 | 1.5 | evidenced | 1.0 | 1.5 |
| 8 | 1.5 | untouched | 0.0 | 0.0 |
| 9 | 1.5 | evidenced | 1.0 | 1.5 |
| 10 | 1.5 | evidenced | 1.0 | 1.5 |
| A.6.1 | 1.0 | evidenced | 1.0 | 1.0 |
| A.6.2 | 1.0 | partial | 0.5 | 0.5 |
| A.8.3 | 1.0 | contradicted | 0.0 | 0.0 |
| A.9.1 | 1.0 | evidenced | 1.0 | 1.0 |
| A.10.2 | excluded | N/A | — | — |

Sum of contributions: 10.75. Effective denominator: 14.5.
**Overall coverage = 10.75 / 14.5 = 0.741 (74.1%)**

---

## Weight Customization

Default weights are set at engagement creation. The lead auditor or
admin can override clause weights (e.g. weight mandatory clauses higher
for a high-risk AIMS). Weight changes:

- Require an explicit auditor action (not automatic).
- Are ledger-anchored (`coverage.weights_updated` event).
- Are visible in the coverage methodology section of the report.

---

## Methodology Transparency

The coverage methodology (formula, weights, status definitions) is:

1. Stored in the audit ledger when the engagement is created.
2. Included verbatim in the issued report's coverage annex.
3. Reproducible: any reviewer with the ledger can reconstruct the
   coverage score from first principles.

---

## Implementation

`packages/coverage-dashboards/src/coverage.calculator.ts` implements
the formula. The API endpoint `GET /v1/engagements/{engagementId}/coverage`
calls this calculator against the current confirmed claims.

---

## Cross-References

- [CLAUDE.md](../../CLAUDE.md) — canonical formula definition.
- [../auditor-guide/11-readiness-vs-audit-mode.md](../auditor-guide/11-readiness-vs-audit-mode.md)
  — how coverage score relates to engagement termination.
- `packages/coverage-dashboards/src/coverage.calculator.ts` — source.
