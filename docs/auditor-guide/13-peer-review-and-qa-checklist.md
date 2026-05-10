<!--
SPDX-License-Identifier: BUSL-1.1
-->

# Peer Review and QA Checklist

> This document covers the pre-publication quality gate: peer review of
> individual findings and the engagement-level QA checklist.

---

## When Peer Review Applies

Peer review is configured at engagement creation. It is mandatory for:

- Stage 2 certification audits (accredited CB programs typically require
  technical review before report issuance).
- Any engagement that generated a major NC.

It is optional for Stage 1, surveillance, and Readiness Mode engagements
(though recommended).

---

## Peer Review Workflow

When a finding is promoted and peer review is enabled:

1. The finding enters `under_peer_review`.
2. An assigned reviewer (a co-auditor or a designated reviewer with the
   `reviewer` role) receives a notification.
3. The reviewer accesses the finding and associated working papers via
   the Peer Review panel (`GET /v1/peer-review/{id}`).
4. The reviewer can:
   - Add **comments** (`POST /v1/peer-review/{id}/comments`) — free text
     with an optional severity tag (clarification / concern / blocking).
   - **Approve** — the finding moves to `open`; a `peer_review.approved`
     ledger event is written.
   - **Escalate to lead auditor** — a `peer_review.escalated` event is
     written; the lead auditor is notified.
5. After all blocking comments are resolved, the reviewer approves.

All peer review actions are ledger-anchored and included in the audit file.

---

## QA Checklist

The QA checklist (`POST /v1/qa-checklist/evaluate`) is a
pre-publication gate that runs automatically when the lead auditor
initiates the `reporting` transition.

The checklist verifies:

| Check | Condition |
|---|---|
| Coverage threshold | Coverage score ≥ plan threshold |
| Candidate findings cleared | All candidate findings reviewed |
| Peer reviews complete | All active peer reviews approved |
| Working papers finalized | All WPs in `finalized` state |
| Evidence chain intact | SHA-256 of all evidence files verified |
| Report conclusion present | Conclusion section non-empty |
| Impartiality declared | All team members have confirmed declarations |
| Mandatory disclaimer present | Readiness Mode only |
| QA sign-off | Lead auditor explicitly acknowledges checklist |

If any check fails, the checklist returns the failing items and the
transition is blocked until they are resolved.

The lead auditor can apply an override for individual checklist items
(`POST /v1/qa-checklist/override`) with a documented rationale. Overrides
are ledger-anchored and included in the report.

---

## Related Documents

- [09-findings-workflow.md](09-findings-workflow.md) — finding promotion.
- [12-reports-and-signing.md](12-reports-and-signing.md) — after QA passes.
- [../api-reference/peer-review.md](../api-reference/peer-review.md).
- [../api-reference/qa-checklist.md](../api-reference/qa-checklist.md).
