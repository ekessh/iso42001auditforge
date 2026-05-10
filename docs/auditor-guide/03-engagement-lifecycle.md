<!--
SPDX-License-Identifier: BUSL-1.1
-->

# Engagement Lifecycle

> This document explains the eight lifecycle stages of an AuditForge
> engagement, the transitions between them, and the mode commitment that
> cannot be reversed.

---

## Mode Commitment

Every engagement is created in one of two modes. The mode is set at
creation and **cannot be changed** (ADR-0013).

| Mode | Use case | Termination condition | Report type |
|---|---|---|---|
| **Audit Mode** | Formal conformity assessment by an accredited CB | Scope covered + all candidate findings reviewed (promoted or dismissed) | Audit report with mandatory CB statement; signed by lead auditor |
| **Readiness Mode** | AIMS owner self-assessment or internal audit | Scope covered + all candidate NCs have CAPA implemented and verified | Readiness report with mandatory non-certification disclaimer |

The API enforces mode at every state transition via the engagement state
machine in `apps/api/src/modules/engagements/`.

---

## Lifecycle Stages

```
created → scoping → planning → active → under_review → reporting → issued → archived
                                 ↑
                          surveillance (re-enters active after issue)
```

### `created`

Initial state. Team assigned. Mode locked. Scope editable.

Ledger event: `engagement.created`

### `scoping`

Lead auditor refines the scope: select in-scope clauses (4–10 mandatory;
Annex A items per AIMS profile), mark exclusions with rationale, confirm
the AI system inventory.

Transition to `planning` requires: at least one in-scope clause, at least
one AI system in inventory, conflict-of-interest declarations from all
team members.

Ledger event: `engagement.scope_locked`

### `planning`

Audit plan created: interview schedule, document request list, sampling
strategy, assigned areas per auditor.

Transition to `active` requires: audit plan approved by lead auditor,
dates confirmed.

Ledger event: `engagement.plan_approved`

### `active`

Main audit execution phase. Interviews, evidence collection, probe runs,
working-paper editing, candidate-finding accumulation.

No automated transition out of `active`. The lead auditor manually
triggers `transition` when they judge the scope to be sufficiently covered.

Ledger event: `engagement.activated`

### `under_review`

All candidate findings reviewed (promoted or dismissed in Audit Mode;
CAPA verified in Readiness Mode). Peer review initiated if applicable.
QA checklist evaluated.

Ledger event: `engagement.under_review`

### `reporting`

Report drafted, formatted, reviewed by co-auditors. Lead auditor edits
the conclusion section directly (engine never writes the conclusion).

Ledger event: `engagement.reporting`

### `issued`

Report signed (Ed25519 + RFC 3161 TSA) and delivered. Audit file frozen.
Coverage calculation anchored in ledger.

Ledger event: `engagement.issued`

### `archived`

Engagement moved to cold storage after retention period. Evidence vault
files remain accessible via signed URLs for the regulatory retention
period (minimum 3 years per ISO 17021-1).

Ledger event: `engagement.archived`

### `surveillance` (sub-type)

For Stage 2 engagements that result in certification, a `surveillance`
child engagement is created annually. It re-enters `active` from
`issued` of the prior cycle. The surveillance engagement shares the
AI system inventory and SoA from the parent; it does not re-run scoping.

---

## Scope Locking

Once the engagement moves from `scoping` to `planning`, the scope
(in-scope clauses + Annex A controls) is locked. Scope changes require:

1. Lead auditor justification (free text).
2. Re-emission of `engagement.scope_locked` to the ledger.
3. If the change narrows scope: a mandatory note in the audit plan and,
   for Audit Mode, notification to the CB.

---

## Conflict-of-Interest Declarations

Each team member must declare conflicts at the `scoping` stage via the
**Impartiality & Independence** screen. Declarations are:

- Signed by the declaring auditor (WebAuthn gesture).
- Anchored to the audit ledger (`impartiality.declared` event).
- Visible to all team members.
- Linked to the issued report.

See [14-impartiality-and-independence.md](14-impartiality-and-independence.md).

---

## API Reference

The engagement state machine is exposed via:

- `POST /v1/engagements` — create.
- `GET /v1/engagements/{id}` — read state.
- `POST /v1/engagements/{id}/transition` — trigger a state transition
  (body: `{ "target": "planning" }`).
- `PATCH /v1/engagements/{id}` — edit metadata (allowed in `created`
  and `scoping` only).

Full schema: [../api-reference/engagements.md](../api-reference/engagements.md).

---

## Related Documents

- [11-readiness-vs-audit-mode.md](11-readiness-vs-audit-mode.md) —
  mode-specific exit semantics.
- [ADR-0013](../adr/0013-mode-separation.md) — rationale for mode
  commitment at creation.
- [../concepts/audit-ledger.md](../concepts/audit-ledger.md) — how
  lifecycle events are anchored.
