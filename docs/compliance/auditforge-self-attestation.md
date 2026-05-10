<!--
SPDX-License-Identifier: BUSL-1.1
-->

# AuditForge Self-Attestation

> This document maps AuditForge's own technical and organizational
> controls to ISO/IEC 42001:2023, ISO/IEC 27001:2022, and SOC 2 Trust
> Services Criteria. AuditForge "eats its own dogfood" — the platform
> is registered in its own AI System Inventory (CLAUDE.md mandate).

---

## AuditForge AI System Profile

| Field | Value |
|---|---|
| System name | AuditForge ISO 42001 v1 |
| System type | AI-assisted audit workbench (decision-support, not decision-making) |
| AI models integrated | Tier-router-selected: Llama 3.1 8B (small), Qwen 2.5 32B (medium), DeepSeek-R1 (reasoning); cloud models opt-in |
| AI model roles | Claim extraction, clause attribution, NC drafting, coverage contextualization |
| Intended use | ISO/IEC 42001 audit execution by accredited lead auditors |
| Out-of-scope use | Automated conformity determination; auditee-facing assessment; non-ISO-42001 audit frameworks (not prohibited, but not validated) |
| Risk level | High — processes sensitive audit data; AI outputs influence audit findings |
| Responsible AI contact | Platform operator (operator-specific) |
| Self-assessment status | Readiness Mode self-assessment; not yet third-party certified |

---

## ISO 42001 Conformity Summary

AuditForge's own AIMS is assessed against ISO 42001:2023 clauses 4–10
and applicable Annex A controls. This is a self-assessment and does not
constitute certification.

### Clause 4 — Context of the Organization

| Sub-clause | Control | AuditForge evidence |
|---|---|---|
| 4.1 | Understanding the organization | Product scope documented in CLAUDE.md and auditforge.md; stakeholder analysis in threat model |
| 4.2 | Interested parties | Auditors, operators, CB firms, accreditation bodies identified |
| 4.3 | Scope | AI system inventory (`packages/ai-system-profiler`) |

### Clause 5 — Leadership

| Sub-clause | Control | AuditForge evidence |
|---|---|---|
| 5.1 | Leadership and commitment | CLAUDE.md mandates signed by project lead; ADR process requires sign-off |
| 5.2 | AI policy | CLAUDE.md + SECURITY.md define AI use policy |
| 5.3 | Roles and responsibilities | Documented in CONTRIBUTING.md; per-PR gates enforce accountability |

### Clause 6 — Planning

| Sub-clause | Control | AuditForge evidence |
|---|---|---|
| 6.1 | AI risk assessment | Threat model in `docs/threat-model/`; per-phase threat model updates (CLAUDE.md per-phase gate) |
| 6.1.2 | AI risk treatment | Security hardening in `docs/security-review/`; SAST (Semgrep), SCA, secrets scan in CI |
| 6.2 | Objectives | Documented in CLAUDE.md (coverage targets, gate requirements) |

### Clause 7 — Support

| Sub-clause | Control | AuditForge evidence |
|---|---|---|
| 7.1 | Resources | GPU infrastructure; pnpm workspace toolchain |
| 7.2 | Competence | Contributor guidelines; lead auditor qualification requirement for Audit Mode |
| 7.3 | Awareness | CLAUDE.md; README.md; documentation (this suite) |
| 7.4 | Communication | SECURITY.md (vulnerability reporting); CODE_OF_CONDUCT.md |
| 7.5 | Documented information | All ADRs, threat model, compliance docs in docs/; Git history is the evidence |

### Clause 8 — Operation

| Sub-clause | Control | AuditForge evidence |
|---|---|---|
| 8.1 | Operational planning | Helm chart; Docker Compose; CI/CD pipeline |
| 8.2 | AI system design | Modular monolith (ADR-0001); schema-constrained extraction (ADR-0010) |
| 8.3 | Data management | Drizzle schema-first; RLS (ADR-0003); bi-temporal claims (ADR-0009) |
| 8.4 | AI system operation | Audit ledger (ADR-0002); LLM invocation logging (ADR-0011) |
| 8.5 | AI system impact assessment | Threat model; DPIA template |

### Clause 9 — Performance Evaluation

| Sub-clause | Control | AuditForge evidence |
|---|---|---|
| 9.1 | Monitoring and measurement | Prometheus metrics; Grafana dashboards; SLO burn-rate alerts |
| 9.2 | Internal audit | CI probe suite (Semgrep, k6, Playwright); per-phase gates |
| 9.3 | Management review | Per-phase architecture review (CLAUDE.md gate) |

### Clause 10 — Improvement

| Sub-clause | Control | AuditForge evidence |
|---|---|---|
| 10.1 | Continual improvement | Wave-based development; ADR retrospectives |
| 10.2 | Nonconformity and corrective action | GitHub Issues; security.md disclosure process |

---

## Summary Assessment

AuditForge's self-assessment indicates substantial conformity with ISO
42001 mandatory clauses 4–10 with the following noted gaps:

1. **Clause 6.1 — AI risk assessment formality**: the threat model is
   maintained but not yet structured as a formal ISO 42001 risk register
   with probability × impact scoring. Target: Phase 16.
2. **Clause 8.3 — Data management**: training data management controls
   are N/A (AuditForge does not train its own models), but data
   provenance for inference inputs should be documented more formally.
3. **Clause 9.3 — Management review**: management review records are
   informal (git log + ADR history). Target: formal quarterly review
   record in Phase 16.

---

## Related Documents

- [iso42001-control-mapping.md](iso42001-control-mapping.md) — detailed
  clause-level mapping table.
- [iso27001-control-mapping.md](iso27001-control-mapping.md) — ISO 27001
  mapping.
- [soc2-trust-services-mapping.md](soc2-trust-services-mapping.md) —
  SOC 2 mapping.
