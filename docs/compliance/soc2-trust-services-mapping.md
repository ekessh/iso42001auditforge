<!--
SPDX-License-Identifier: BUSL-1.1
-->

# SOC 2 Trust Services Criteria Mapping

> Mapping of AuditForge's controls to SOC 2 Trust Services Criteria
> (2017 revision) for the Security, Availability, Confidentiality, and
> Privacy categories.

---

## CC — Common Criteria (Security)

| Criterion | Name | AuditForge implementation | Status |
|---|---|---|---|
| CC1.1 | COSO Principle 1 — Integrity and ethics | CLAUDE.md; CODE_OF_CONDUCT.md; CLA.md | implemented |
| CC3.2 | Specifies security objectives | CLAUDE.md per-phase gates; threat model | implemented |
| CC5.1 | Selects and develops control activities | CI per-PR gates; Semgrep; TypeScript strict | implemented |
| CC6.1 | Logical access controls | WebAuthn passkeys; Postgres RLS; RBAC | implemented |
| CC6.2 | Prior to registration | Operator provisions users; passkey enrollment required | implemented |
| CC6.3 | Identity management | WebAuthn credential store (ADR-0020 follow-up: HSM) | partial |
| CC6.6 | Transmission of confidential information | TLS 1.3 at ingress; WebSocket over TLS | implemented |
| CC6.7 | Encryption of confidential information at rest | Postgres encrypted volume (operator responsibility); MinIO SSE | partial |
| CC7.1 | Vulnerability detection tools | `pnpm audit`; Semgrep; Gitleaks; Dependabot | implemented |
| CC7.2 | Monitoring and evaluation | Prometheus; Grafana; SLO alerts; audit ledger | implemented |
| CC7.3 | Incident response | SECURITY.md; `docs/operator-guide/11-incident-response.md` | implemented |
| CC7.4 | Incident response program | Incident severity matrix; runbooks; post-mortem process | partial |
| CC8.1 | Change management | Conventional Commits; PR gates; Helm versioned releases | implemented |
| CC9.2 | Risk management | Threat model; probe suite; ADR risk sections | partial |

---

## A — Availability

| Criterion | AuditForge implementation | Status |
|---|---|---|
| A1.1 | SLO burn-rate alerts; Prometheus; Grafana | implemented |
| A1.2 | HPA; PVC-backed stateful components; managed DB option | implemented |
| A1.3 | DR: Postgres WAL backup; MinIO replication; Helm rollback | partial |

---

## C — Confidentiality

| Criterion | AuditForge implementation | Status |
|---|---|---|
| C1.1 | Postgres RLS (tenant isolation); per-engagement RBAC; candidate findings inaccessible to auditee role | implemented |
| C1.2 | LLM invocation log provides model-level data lineage; bi-temporal claims track provenance | implemented |

---

## P — Privacy (selected)

| Criterion | AuditForge implementation | Status |
|---|---|---|
| P1.1 (Notice) | Consent registry; cloud LLM consent statement (displayed before enabling) | implemented |
| P3.1 (Collection) | Schema-constrained extraction limits what is captured; consent gates cloud processing | implemented |
| P4.2 (Use, Retention) | Retention policy documented; operator-configurable retention period; WORM evidence storage | partial |
| P6.1 (Access) | Auditor can download all evidence files they uploaded; operator-configurable data export | partial |
| P8.1 (Disclosure to third parties) | Cloud LLM consent documents disclosure to Anthropic/OpenAI; DPA template | implemented |

---

## Notes

SOC 2 Type II certification requires an independent service auditor's
examination over a period (typically 6–12 months). This mapping supports
readiness assessment only. Engage a licensed CPA firm for formal
certification.

---

## Related Documents

- [auditforge-self-attestation.md](auditforge-self-attestation.md) —
  ISO 42001 self-assessment.
- [dpia-template.md](dpia-template.md) — privacy impact assessment.
- [data-flows-and-dpa.md](data-flows-and-dpa.md) — data flows for DPA.
