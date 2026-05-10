<!--
SPDX-License-Identifier: BUSL-1.1
-->

# Readiness Mode vs Audit Mode

> This document specifies what each mode permits, the exit conditions,
> and the mandatory disclaimers.

---

## Mode Comparison

| Dimension | Audit Mode | Readiness Mode |
|---|---|---|
| **Who uses it** | Accredited Certification Bodies and their lead auditors | AIMS owners, internal auditors, or pre-certification readiness assessors |
| **Terminates when** | Scope covered + all candidate findings reviewed (promoted or dismissed) | Scope covered + all candidate NCs have CAPA implemented and verified |
| **Report type** | Formal audit report with CB statement | Readiness report with mandatory non-certification disclaimer |
| **Report signing** | Lead auditor (hardware-backed key, accredited CB affiliation required) | AIMS owner or internal auditor |
| **Auditee portal** | Active (can receive formal findings post-promotion) | Inactive |
| **Right-pane labels** | "Candidate Findings" / "Promote to Finding" | "Improvement Items" / "Add to Action Plan" |
| **CAPA requirement** | CAPA raised and tracked; closure not required for report issuance | All action items must be closed before the engagement can issue |
| **Admissibility in Audit Mode** | — | Readiness findings are **not** admissible as evidence in a subsequent Audit Mode engagement. The CB performs its own independent conformity assessment. |

---

## Audit Mode Exit Semantics

The lead auditor manually triggers the transition from `active` to
`under_review` when they judge that:

1. All in-scope clauses have at least one interview, evidence item, or
   probe result addressing them (or are marked N/A with rationale).
2. All candidate findings have been reviewed: promoted to formal finding,
   or dismissed with rationale.
3. The coverage calculation (see
   [../concepts/coverage-calculation.md](../concepts/coverage-calculation.md))
   reaches or exceeds the threshold set in the engagement plan.

The system does not auto-trigger this transition. There is no minimum
coverage score enforced by the system — the auditor's professional
judgment controls termination. The coverage score is informational.

---

## Readiness Mode Exit Semantics

In Readiness Mode, the engagement cannot proceed to `reporting` until:

1. The coverage threshold from the plan is met.
2. Every candidate NC has an associated CAPA with status `closed`.
   Closing requires: corrective action documented, verification evidence
   uploaded, lead auditor sign-off.

---

## Mandatory Readiness Mode Disclaimer

Every readiness report includes the following disclaimer (hardcoded; not
editable):

> **This report is the output of a readiness self-assessment conducted
> using AuditForge. It is not a certification audit, does not confer
> ISO/IEC 42001 certification, and must not be represented as such. Only
> an accredited Certification Body can award ISO/IEC 42001 certification.
> The conclusions in this report are self-assessed and have not been
> independently verified by a third-party auditor.**

The disclaimer text is stored in `packages/report-engine/src/templates/`
and its hash is recorded in the issued report's ledger event. Operators
cannot remove or alter this disclaimer.

---

## Mode Cannot Be Changed Mid-Engagement

ADR-0013 is explicit: the engagement mode is set at creation and cannot
change. The API returns HTTP 422 if a `transition` payload attempts to
change the mode. The rationale is audit-ledger semantic integrity: the
engagement's event stream is interpreted differently depending on the mode,
and retroactive mode changes would break bi-temporal reconstruction.

If the wrong mode was selected:

1. Archive the engagement with a rationale (auditor action required).
2. Create a new engagement with the correct mode.
3. Evidence files from the archived engagement can be imported into the
   new engagement via the Archive module.

---

## Related Documents

- [03-engagement-lifecycle.md](03-engagement-lifecycle.md) — lifecycle
  stages.
- [09-findings-workflow.md](09-findings-workflow.md) — findings in each
  mode.
- [ADR-0013](../adr/0013-mode-separation.md) — mode commitment rationale.
- [../concepts/coverage-calculation.md](../concepts/coverage-calculation.md).
