# @auditforge/peer-review

Pre-issuance peer-review workflow, quality checklists, scoring, and
reviewer-independence invariants for the AuditForge ISO 42001 lead-auditor
workbench.

License: BUSL-1.1.

## Scope

Implements Section 3.12 ("Peer Review, Quality, Archive") and Phase 12 of the
design (`auditforge.md`). It is a pure domain library: persistence, transport,
and scheduling live in `apps/api`. Outbound integrations (audit ledger emit,
billing productivity feed) are exposed as ports.

## Modules

- `domain/` — `PeerReviewRequest`, `PeerReviewChecklist`, `PeerReviewResponse`,
  `PeerReviewVerdict`, `QualityChecklistItem`, plus a finite-state-machine
  status type (`pending | in_review | changes_requested | approved | withdrawn`).
- `workflow/` — `PeerReviewWorkflow` orchestrator (assign, load checklist,
  capture responses, sign-off). Transitions are exhaustively enumerated.
- `registry/` — `ChecklistRegistry`: versioned templates per audit type with
  CB-level customization that preserves base-template provenance.
- `scoring/` — `QualityScoring`: aggregates response rates and produces an
  `AuditorProductivityFeed` payload consumed by `@auditforge/billing`.
- `invariants/` — `InvariantsChecker`: peer reviewer cannot be the primary
  auditor, cannot be on the engagement team, must satisfy CB independence
  rules (configurable lookback and supervisor-of-record exclusions).

## Independence rules (defaults; CB-overridable)

- Reviewer identity ≠ primary lead auditor on the engagement.
- Reviewer identity ∉ engagement team auditors.
- Reviewer cannot have peer-reviewed the auditor's last `N` engagements
  (default `N=2`) — prevents reciprocal review pairs from forming.
- Reviewer must hold `peer_reviewer` role at the same firm.
- CBs may override the rule set via `IndependencePolicy` overrides.

## State machine

```
   pending  ── assign     ─▶  in_review
   in_review ── request_changes ─▶ changes_requested
   changes_requested ── resubmit  ─▶ in_review
   in_review ── approve   ─▶  approved        (terminal)
   pending  ── withdraw   ─▶  withdrawn       (terminal)
   in_review ── withdraw  ─▶  withdrawn       (terminal)
   changes_requested ── withdraw ─▶ withdrawn (terminal)
```

`approved` and `withdrawn` are terminal. Re-opening requires creating a new
`PeerReviewRequest` (a new domain ID, new ledger event chain).

## Quality scoring

`QualityScoring.aggregate()` returns:

- `passRate`, `failRate`, `naRate` — per-item response distribution.
- `weightedScore` — sum of `weight * passIndicator` over non-NA items.
- `commentDensity` — fraction of items with a non-empty comment.
- `productivityFeed` — flat record consumed by `@auditforge/billing` to
  compute `AuditorProductivityMetrics.ncQualityScore`.

## Cross-tenant guarantees

Every workflow operation is scoped to a `TenantContext`. Cross-tenant
retrieval and edit attempts raise `TenantViolation`.
