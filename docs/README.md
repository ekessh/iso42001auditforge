<!--
SPDX-License-Identifier: BUSL-1.1
-->

# AuditForge Documentation

> This index is the single entry point for all AuditForge documentation. Pick
> your audience below and follow the "Start here" link.

AuditForge is an exclusive workbench for ISO/IEC 42001 Lead Auditors. It is
**not** a tool for auditees. Every capability described in this documentation
is scoped to the auditor's perspective unless explicitly labelled "operator" or
"developer."

---

## Audience Matrix

| Audience | Role | Start here |
|---|---|---|
| **Lead Auditor** | Conducts AIMS audits; signs reports; manages findings | [Auditor Guide → Overview](auditor-guide/01-overview.md) |
| **Co-Auditor** | Supports the lead; edits working papers; limited promotion rights | [Getting Started](auditor-guide/02-getting-started.md) |
| **Operator / SRE** | Deploys, monitors, scales, and backs up AuditForge | [Operator Guide → Overview](operator-guide/01-overview.md) |
| **Developer / Contributor** | Extends or maintains the codebase | [Developer Guide → Onboarding](developer-guide/01-onboarding.md) |
| **Compliance Officer** | Maps AuditForge's own controls to ISO 42001, ISO 27001, SOC 2 | [Compliance → Self-Attestation](compliance/auditforge-self-attestation.md) |

---

## Project Status

| Wave | Phases covered | Key deliverables |
|---|---|---|
| Wave 1 | 0–5 | Core NestJS API, Drizzle schema, Postgres RLS, Auth.js + WebAuthn, Audit Ledger (Ed25519 + RFC 3161), basic probe runner, Next.js UI shell |
| Wave 2 | 6–7 | Evidence vault (MinIO), VLM extraction (Qwen2.5-VL / DeepSeek-OCR), Yjs CRDT working papers, Meilisearch + pgvector hybrid search, Tauri desktop, PWA mobile |
| Wave 3 | 7.5–7.7 | Audit Memory Layer, LLM Provider Abstraction, Conversational Engine (question generator, attribution, NC drafter, coverage tracker), live interview + WhisperX diarization, readiness/audit dashboards |
| Wave 4 | 8–14 | Peer review, QA checklist, CAPA tracking, sampling planner, surveillance module, cross-framework mapping, MCP server, cross-engagement memory, signing + PDF/A-3 report pipeline |

Current phase: **15 (in progress)** — cross-engagement memory, MCP server GA, compliance documentation.

---

## Documentation Map

```mermaid
graph TD
  A[docs/README.md\nThis file] --> B[auditor-guide/]
  A --> C[operator-guide/]
  A --> D[developer-guide/]
  A --> E[concepts/]
  A --> F[api-reference/]
  A --> G[compliance/]
  A --> H[tutorials/]
  A --> I[adr/]
  A --> J[threat-model/]
  A --> K[security-review/]

  B --> B1[01-overview]
  B --> B2[05-conversational-engine]
  B --> B3[12-reports-and-signing]

  C --> C1[03-installation]
  C --> C2[05-air-gap-deployment]
  C --> C3[09-secrets-and-key-rotation]

  D --> D1[01-onboarding]
  D --> D2[06-adding-a-new-domain]

  E --> E1[audit-ledger]
  E --> E2[claim-graph]
  E --> E3[tier-router]

  G --> G1[auditforge-self-attestation]
  G --> G2[iso42001-control-mapping]
```

---

## Cross-References

- **Architecture Decision Records**: [adr/](adr/)
- **Threat Model**: [threat-model/](threat-model/)
- **Security Review**: [security-review/](security-review/)
- **Probe Catalogue**: [security/probe-catalogue.md](security/probe-catalogue.md)
- **Operator Runbooks**: [../infra/runbooks/](../infra/runbooks/)
- **CHANGELOG**: [CHANGELOG.md](CHANGELOG.md)
- **Root README**: [../README.md](../README.md)
