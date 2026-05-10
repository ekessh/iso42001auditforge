<!--
SPDX-License-Identifier: BUSL-1.1
-->

# ISO 42001 Control Mapping

> Table mapping each ISO/IEC 42001:2023 control to the AuditForge
> implementation with source file citations.

---

## Reading This Table

- **Control**: ISO 42001:2023 clause or Annex A control ID.
- **AuditForge implementation**: the code or config artifact.
- **Evidence**: file path and, where relevant, line reference.
- **Status**: `implemented`, `partial`, or `gap`.

---

## Mandatory Clauses (4–10)

| Control | AuditForge implementation | Evidence | Status |
|---|---|---|---|
| 4.1 — Context | Product scope, stakeholder map | `CLAUDE.md`, `auditforge.md` | implemented |
| 4.3 — Scope | AI System Inventory | `packages/ai-system-profiler/src/` | implemented |
| 5.2 — AI policy | Development governance policy | `CLAUDE.md` | implemented |
| 6.1.2 — Risk treatment | Threat model + SAST | `docs/threat-model/`, `semgrep/` | partial |
| 6.2 — AI objectives | Coverage targets, per-PR and per-phase gates | `CLAUDE.md` | implemented |
| 7.5 — Documented information | ADR, threat model, compliance docs | `docs/adr/`, `docs/threat-model/`, `docs/compliance/` | implemented |
| 8.2 — AI design | Modular monolith; schema constraints | `docs/adr/0001-modular-monolith.md`, `docs/adr/0010-schema-constrained-extraction.md` | implemented |
| 8.3 — Data management | Drizzle schema-first; RLS; bi-temporal | `packages/db/src/schema/`, `docs/adr/0003-postgres-rls-tenancy.md`, `docs/adr/0009-bi-temporal-claim-graph.md` | implemented |
| 8.4 — AI operation | Audit ledger; LLM invocation log | `packages/audit-engine/src/`, `docs/adr/0002-event-sourced-audit-ledger.md` | implemented |
| 8.5 — Impact assessment | Threat model; DPIA template | `docs/threat-model/`, `docs/compliance/dpia-template.md` | partial |
| 9.1 — Monitoring | Prometheus; Grafana; SLOs | `infra/observability/`, `infra/grafana/` | implemented |
| 9.2 — Internal audit | Semgrep SAST; CI probes | `semgrep/`, `tests/probe-validity/` | implemented |
| 10.2 — NC and CA | GitHub Issues; security disclosure | `SECURITY.md` | partial |

---

## Annex A Controls

| Control ID | Name | AuditForge implementation | Status |
|---|---|---|---|
| A.2.2 | AI system design principles | Engine-as-draft rule (ADR-0012); auditor-confirmation gate | implemented |
| A.2.6 | AI system transparency | LLM invocation log with model, prompt template, confidence | implemented |
| A.3.2 | Roles and responsibilities | RBAC via `packages/auth-core/`; per-engagement team roles | implemented |
| A.4.2 | Internal use of AI systems | AuditForge self-profile in AI System Inventory | implemented |
| A.5.2 | Data governance | Drizzle schema; RLS; bi-temporal claims; consent registry | implemented |
| A.6.1.2 | AI risk identification | Threat model; probe suite | partial |
| A.6.2.3 | AI risk treatment | CAPA tracking; finding workflow | implemented |
| A.6.2.5 | Documentation of AI systems | AI System Inventory; per-model metadata in invocation log | implemented |
| A.8.4 | Supplier and third-party management | Cloud LLM consent guard (ADR-0025); DPA template | implemented |
| A.9.1 | Incident management | Incident response runbook; SECURITY.md | partial |
| A.10.1 | Logging and monitoring | Audit ledger (append-only, signed); Pino + OTEL | implemented |
| A.10.5 | Performance testing | k6 load tests; per-phase performance gate | partial |
