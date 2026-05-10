<!--
SPDX-License-Identifier: BUSL-1.1
-->

# Impartiality and Independence

> This document explains how AuditForge enforces ISO 17021-1 impartiality
> requirements programmatically.

---

## ISO 17021-1 Obligations

ISO 17021-1 §4 (impartiality) and §9.1.3 (audit team competence and
impartiality) require that:

- The audit team has no conflict of interest with the auditee.
- Threats to impartiality are identified, evaluated, and documented.
- The CB's management reviews and acts on impartiality risks.

AuditForge implements these requirements as system controls, not just
policy documentation.

---

## Conflict-of-Interest Declaration

At the `scoping` lifecycle stage, each team member must complete the
**Impartiality Declaration** form:

1. Navigate to **Engagement → Team → Impartiality**.
2. Each member answers the standard threat checklist:
   - Self-interest (financial interest in the auditee).
   - Self-review (previously designed the auditee's AIMS).
   - Advocacy (acting as consultant for the auditee within 2 years).
   - Familiarity (close personal relationship with auditee key personnel).
   - Intimidation (auditee has threatened the auditor).
3. If a threat is identified, the member records the nature and the
   mitigation measure.
4. The declaration is **signed** (WebAuthn gesture).
5. The signed declaration is stored and ledger-anchored
   (`impartiality.declared` event).
6. The lead auditor reviews all declarations and records their
   impartiality review decision.

The engagement cannot transition from `scoping` to `planning` unless all
team members have confirmed declarations.

---

## System-Level Controls

Beyond declarations, AuditForge enforces:

| Control | Implementation |
|---|---|
| Auditor cannot audit their own organization | At engagement creation, the system checks if the auditor's `firm_id` matches the client's `organization_id`. If they match, creation is blocked with an error. |
| Auditee role cannot access candidate findings | Postgres RLS policy on `candidate_findings` denies the `auditee` role unconditionally. |
| Former consultant exclusion | If an auditor's profile records a consulting relationship with the client (within a configurable window, default 2 years), the system flags — but does not block — engagement creation and requires an impartiality override with senior approval. |
| Dual-key report signing | The report signature key is distinct from the session authentication key. Operators cannot issue a signed report without the lead auditor's private key gesture. |

---

## Consent Records

All consent records (interviewee recording consent, cloud LLM data
processing consent) are:

- Stored in `packages/consent-registry`.
- Signed and ledger-anchored.
- Linked to the relevant engagement and report.
- Retained for the engagement's retention period.

See [../concepts/consent-and-air-gap.md](../concepts/consent-and-air-gap.md).

---

## Related Documents

- [03-engagement-lifecycle.md](03-engagement-lifecycle.md) — scoping
  stage gating.
- [../compliance/auditforge-self-attestation.md](../compliance/auditforge-self-attestation.md)
  — how AuditForge's own controls map to ISO 42001.
