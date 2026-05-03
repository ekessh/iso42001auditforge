# @auditforge/nc-drafter

Parallel NC Drafter — v3 Phase 7.7.

Background analysis service that runs over confirmed claim attribution events to
draft candidate findings (Major NC / Minor NC / OFI / Observation) for auditor
review. Outputs are **always drafts**; candidate findings are **never** visible
to the auditee — only auditor-promoted formal Findings cross the boundary
(ADR 0012, ADR 0013).

## Detectors

| Detector                       | Trigger                                                                | Output                                                           |
| ------------------------------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `DirectConformityGapDetector`  | Claim explicitly states a control isn't implemented                    | Minor or Major NC depending on clause severity + audit type     |
| `EvidenceAbsenceDetector`      | Audit plan expected evidence for clause X; interview ended w/ none     | Minor NC for "objective evidence not provided"                   |
| `ContradictionDerivedDetector` | Two contradicting claims imply a control breach                        | Candidate NC (severity inferred from clause family)              |
| `SystemicPatternDetector`      | Same control fails across multiple sampled units                       | Major NC (systemic)                                              |
| `OfiSignalDetector`            | Process described as fragile, manual, or undocumented but functioning  | Opportunity For Improvement                                      |

## Lifecycle

```
detector → candidate_finding (status=pending)
                  │
                  ├─► auditor promote → v2 Finding (state=draft) + status=promoted
                  ├─► auditor edit    → status=edited (then promote / dismiss)
                  ├─► auditor park    → status=parked
                  └─► auditor dismiss + reason → status=dismissed
                                                │
                                                ▼
                                  candidate_finding_decisions
                                  (negative-feedback corpus, Phase 16)
```

## Hard rules

1. Candidate findings are **never** visible to the auditee role. The read API
   filters by role and refuses to serve candidates to auditee subjects.
2. Promotion **never** happens automatically; it requires an auditor-issued
   `PromotionRequest`.
3. Dismissal with reason `'other'` requires non-empty free-text per
   `DismissalReason` validation.

## License

BUSL-1.1. See repository LICENSE.
