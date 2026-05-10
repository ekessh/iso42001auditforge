<!--
SPDX-License-Identifier: BUSL-1.1
-->

# Data Protection Impact Assessment Template

> This template helps operators adapt a DPIA for their AuditForge
> deployment. It is not legal advice. Engage a qualified DPO or legal
> counsel before submitting a DPIA to a supervisory authority.

---

## 1. Description of Processing

| Field | Value (operator to complete) |
|---|---|
| Controller | [Operator firm name and address] |
| Processor | AuditForge (if SaaS); or controller = operator (if self-hosted) |
| DPO contact | [DPO name and email] |
| Processing purpose | Execution of ISO/IEC 42001 conformity assessments on AI Management Systems |
| Legal basis | Art. 6(1)(b) GDPR (contract performance) or Art. 6(1)(f) (legitimate interest) |
| Categories of data subjects | AIMS owners, AI system operators, internal audit stakeholders of the auditee organization |
| Categories of personal data | Names, job titles, email addresses (from consent records); audio recordings and transcripts (from live interviews); documents potentially containing personal data (uploaded evidence) |
| Special categories | Potentially: biometric data (if voice samples used for authentication — not currently a product feature) |
| Retention period | [Operator to set; minimum 3 years per ISO 17021-1; regulatory requirements may require longer] |
| International transfers | Only if cloud LLM is enabled: data may be transferred to Anthropic (US) or OpenAI (US) under SCCs |

---

## 2. Necessity and Proportionality

| Question | Response |
|---|---|
| Is the processing proportionate to the purpose? | Yes — AuditForge processes only the minimum data necessary for audit execution. Audio recordings are retained only for the engagement period unless the auditor explicitly archives them. |
| Are there less privacy-invasive alternatives? | Manual audit (paper-based) is less privacy-invasive but significantly less effective for AI system assessment. AuditForge offers air-gap mode to eliminate cloud processing. |
| Are data minimization principles applied? | Yes — schema-constrained extraction limits what claims are captured; consent gates limit cloud processing. |

---

## 3. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Unauthorized access to audit data | Low | High | Postgres RLS; WebAuthn; TLS 1.3; RBAC |
| Evidence data exfiltration | Low | High | MinIO SSE; presigned URLs expire after 1 hour; no direct DB access from UI |
| Audio recording disclosure | Medium | Medium | Recordings stored encrypted; consent required; access limited to audit team |
| Cloud LLM data processing | Medium (if opted-in) | Medium | Written consent required; SCCs with Anthropic/OpenAI; air-gap mode available |
| Cross-engagement data leakage | Low | High | RLS enforces tenant isolation; cross-engagement memory is opt-in and anonymized |
| Audit ledger manipulation | Very low | Very high | Ed25519 + hash chain + RFC 3161 TSA; append-only DB trigger |

**Residual risk**: Low for air-gap deployments; Medium for cloud LLM
enabled deployments (mitigated by consent and SCCs).

---

## 4. Consultation

| Party | Consultation status |
|---|---|
| Data subjects (auditees) | Informed via consent statement before recording begins |
| DPO | [Operator to record DPO consultation date] |
| Supervisory authority (if required) | [Complete if residual risk is high after mitigation] |

---

## 5. Decision and Sign-Off

| Field | Value |
|---|---|
| Processing approved | Yes / No |
| Conditions | [Any conditions on processing] |
| Review date | [Date; recommend annually or after significant product changes] |
| Signed by | [DPO / Controller representative] |

---

## Related Documents

- [data-flows-and-dpa.md](data-flows-and-dpa.md) — data flows for DPA
  with cloud providers.
- [../concepts/consent-and-air-gap.md](../concepts/consent-and-air-gap.md)
  — consent mechanism.
