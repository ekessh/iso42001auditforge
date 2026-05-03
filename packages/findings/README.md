# @auditforge/findings

Findings, Non-Conformity (NC), Observation, OFI, and Conformity registry for
AuditForge ISO/IEC 42001. Implements **Section 3.7 — Findings, NC & CAPA**
(Phase 7) of `auditforge.md`.

This package owns:

- **Finding domain types** — Major NC / Minor NC / OFI / Conformity, with
  multi-clause + multi-Annex-A linking, evidence linking, and full audit trail.
- **FindingRegistry** — tenant-scoped CRUD with ledger event emission.
- **NumberingService** — pluggable per-CB numbering schemes
  (e.g. `NC-{year}-{seq}`, `OFI-{engagement}-{seq}`) with template variables.
- **StateMachine** — explicit, exhaustive, role-gated state machine
  `draft → issued → accepted | disputed → resolved → closed`.
- **MultiClauseLinker** — validates clause + Annex A control IDs against the
  catalogue from `@auditforge/catalogues`.
- **SurveillanceCarryForwardEngine** — open NCs auto-appear on the next
  surveillance plan; emits ledger events on carry.
- **TrendAnalytics** — per-client + scheme-level NC frequency, root-cause
  topic clustering, time-to-close, recurrence rate.

> No standard text is reproduced here. References to ISO/IEC 17021-1
> 9.4.8 and ISO/IEC 42001 Annex A are by clause/control ID only.

## State machine

```
       ┌─────────┐  issue   ┌────────┐
       │  draft  │─────────▶│ issued │
       └─────────┘          └────────┘
                              │      │
                       accept │      │ dispute
                              ▼      ▼
                        ┌──────┐  ┌─────────┐
                        │ accepted │  disputed │
                        └──────┘  └─────────┘
                          │            │
                  resolve │      resolve (after disposition)
                          ▼            ▼
                        ┌────────────────┐
                        │    resolved    │
                        └────────────────┘
                                 │ close
                                 ▼
                            ┌────────┐
                            │ closed │
                            └────────┘
```

Transitions are restricted by role (`auditor`, `lead_auditor`, `auditee`,
`reviewer`). Disallowed transitions surface as `StateMachineError` from
`@auditforge/shared/errors`.

## Quickstart

```ts
import {
  createFindingRegistry,
  createDefaultStateMachine,
  createNumberingService,
  defaultNumberingSchemes,
  inMemoryLedger,
} from '@auditforge/findings';

const ledger = inMemoryLedger();
const numbering = createNumberingService(defaultNumberingSchemes());
const machine = createDefaultStateMachine();
const registry = createFindingRegistry({ numbering, machine, ledger });
```

## License

BUSL-1.1 (Business Source License 1.1) — see repo root `LICENSE`.
