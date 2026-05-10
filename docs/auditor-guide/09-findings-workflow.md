<!--
SPDX-License-Identifier: BUSL-1.1
-->

# Findings Workflow

> This document describes the path from an engine-generated candidate
> finding through peer review, promotion to formal finding, and CAPA
> tracking.

---

## Finding States

```
candidate_finding
  └─ [auditor: promote]  → finding (open)
  └─ [auditor: dismiss]  → (dismissed; ledger event; not visible to auditee)

finding (open)
  ├─ [if peer review enabled] → under_peer_review
  │     └─ [reviewer approves] → open
  ├─ [CAPA raised]           → capa_in_progress
  └─ [auditor: close]        → closed

finding (closed)
  └─ included in issued report
```

---

## Candidate Findings

Candidate findings are created by:

1. The **NC Drafter** during interview sessions and evidence extraction.
2. The **Probe Runner** when a probe result is `fail`.
3. The **Auditor** manually via **+ Add Candidate Finding**.

Candidate findings are:

- Visible only to the audit team.
- Never exposed to the auditee. This is a hard system constraint
  enforced by RLS policy: the `candidate_findings` table has no row
  accessible by the auditee role.
- Stored under `apps/api/src/modules/candidate-findings/`.

Each candidate finding contains:

- Draft observation text (editable by auditor).
- Suggested severity: **major NC**, **minor NC**, or **opportunity for
  improvement (OFI)** — auditor decides finally.
- Clause reference(s).
- Supporting evidence links.
- Attribution provenance (model, prompt template version, confidence).

---

## Promoting a Candidate Finding

To promote a candidate finding to a formal finding:

1. Open the Candidate Findings panel.
2. Review the observation text. Edit if needed.
3. Select the final severity.
4. Link any additional evidence.
5. Click **Promote to Finding**
   (`POST /v1/engagements/{engagementId}/candidate-findings/{cfId}/promote`).

The API:

- Creates a formal `finding` row with status `open`.
- Links the evidence.
- Emits `finding.promoted` to the audit ledger.
- If peer review is configured for the engagement: automatically creates
  a peer review task.

---

## Dismissing a Candidate Finding

If the candidate finding is not warranted:

1. Click **Dismiss**.
2. Enter a dismissal rationale (required).
3. The dismissal is recorded in the ledger (`finding.dismissed` event).

Dismissed findings are retained in the system (for the engagement's
retention period) but are excluded from the report.

---

## Peer Review

If the engagement has peer review enabled (set at engagement creation or
by the lead auditor):

1. After promotion, the finding enters `under_peer_review`.
2. The assigned reviewer receives a notification.
3. The reviewer accesses the finding, working papers, and evidence via
   `GET /v1/peer-review/{id}`.
4. The reviewer can:
   - **Approve** — finding moves to `open`.
   - **Request changes** — adds comments; finding stays `under_peer_review`.
   - **Escalate** — flags the finding for lead-auditor attention.
5. All reviewer actions are ledger-anchored.

See [13-peer-review-and-qa-checklist.md](13-peer-review-and-qa-checklist.md).

---

## CAPA Tracking (Audit Mode)

For formal audit findings in Audit Mode:

1. The lead auditor raises a CAPA record
   (`POST /v1/capa` linking the finding).
2. The CAPA record includes: root cause analysis (optional at creation),
   corrective action plan, responsible party, due date.
3. The auditee (via auditee portal, if configured) submits evidence of
   corrective action.
4. The auditor verifies the evidence and **closes** the CAPA.
5. The finding is linked to the closed CAPA; both appear in the report.

In **Readiness Mode**, CAPA closure is a termination condition for the
engagement. The engagement cannot move to `reporting` until all candidate
NCs are closed.

---

## Finding Inclusion in Reports

All formal findings with status `closed` (or `open` with a documented
rationale for inclusion) are included in the issued report:

- Major NCs: listed with full observation, clause ref, and CAPA status.
- Minor NCs: listed with observation and clause ref.
- OFIs: listed in a separate section.
- Dismissed candidates: not included.

See [12-reports-and-signing.md](12-reports-and-signing.md).

---

## Related Documents

- [05-conversational-engine.md](05-conversational-engine.md) — NC drafter.
- [08-probes-and-conformance-checks.md](08-probes-and-conformance-checks.md)
  — probe-to-finding path.
- [13-peer-review-and-qa-checklist.md](13-peer-review-and-qa-checklist.md).
- [../api-reference/candidate-findings.md](../api-reference/candidate-findings.md).
- [../api-reference/findings.md](../api-reference/findings.md).
