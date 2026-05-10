<!--
SPDX-License-Identifier: BUSL-1.1
-->

# Auditor Guide — Overview

> This document tells you what AuditForge is, what it explicitly is not,
> and the legal boundaries that govern its use.

---

## What AuditForge Is

AuditForge is an exclusive workbench for **ISO/IEC 42001 Lead Auditors**
performing conformity assessment of AI Management Systems (AIMS). It covers
the full audit lifecycle from engagement planning through signed report
delivery and post-certification surveillance.

Capabilities:

- **Engagement management** — scope, mode, team, timeline, audit plan.
- **Conversational audit engine** — AI-assisted question generation,
  clause attribution, adaptive follow-up, parallel NC drafting. All engine
  outputs are drafts; only the auditor's confirmation changes state.
- **Evidence vault** — encrypted upload, chain-of-custody, VLM extraction.
- **Working papers** — Yjs CRDT collaborative editing with full offline
  support.
- **Probe suite** — AC-*, P-LLM-*, P-MCP-*, P-DATA-*, P-RISK-*, P-GOV-*,
  P-AGENT-*, P-CHAIN-* conformance checks against OWASP LLM Top 10, MITRE
  ATLAS, and ISO 42001 Annex A controls.
- **Findings and CAPA** — candidate finding → peer review → promotion →
  formal finding → CAPA tracking.
- **Sampling planner** — textbook attribute and variable methods;
  seed-stable replay.
- **Signed reports** — DOCX + PDF/A-3; Ed25519 signature; RFC 3161 TSA;
  audit ledger anchoring.
- **Cross-engagement memory** — anonymized pattern retrieval across prior
  engagements within the same firm (Phase 15, opt-in).
- **MCP server** — expose audit tool calls to Claude Desktop or an IDE
  (Phase 15).

---

## What AuditForge Is Not

| Capability | Why it is excluded |
|---|---|
| Auditee portal / self-assessment product | Auditor's tool only. Candidate findings are never exposed to the auditee. |
| Certification authority | AuditForge does not issue certificates. Only the accredited CB issues a certificate. |
| Automatic conformity conclusion | The engine never concludes conformity. The auditor concludes in the signed report. |
| Black-box AI recommendation | Every suggestion carries provenance: library question ID, clause ref, coverage rationale, model name, prompt template version. |
| Standalone risk management system | AuditForge assesses AIMS risk management; it does not replace the AIMS owner's own risk treatment. |

---

## Legal Framing

AuditForge is licensed under **Business Source License 1.1 (BUSL-1.1)**.
Source is available but not Open Source until the Change Date (four years
after each version's release, at which point it converts to Apache-2.0).

**Production use is permitted** except for offering AuditForge as a
competing hosted/embedded:

- certification management service,
- audit management service, or
- AI governance service.

The Additional Use Grant permits all other production use including
self-hosted installations by Certification Bodies, internal auditors, and
AIMS owners operating in Readiness Mode.

See [LICENSE](../../LICENSE), [NOTICE](../../NOTICE),
[TRADEMARK.md](../../TRADEMARK.md), and [CLA.md](../../CLA.md) for the
full legal texts.

---

## Standards Implemented

| Standard | Scope in AuditForge |
|---|---|
| ISO/IEC 42001:2023 | Full clause and Annex A catalogue; coverage calculation; question library |
| ISO/IEC 17021-1:2015 | Audit lifecycle, impartiality, record integrity requirements |
| IAF MD 5, IAF MD 23 | Programme requirements reflected in engagement state machine |
| NIST AI RMF 1.0 | Cross-framework mapping; probe categories |
| EU AI Act (Regulation 2024/1689) | Cross-framework mapping; DPIA templates |
| OWASP LLM Top 10 | P-LLM-* probe category |
| MITRE ATLAS | P-AGENT-* and P-CHAIN-* probe categories |

---

## Impartiality Note

AuditForge enforces ISO 17021-1 impartiality requirements
programmatically. The auditor is prompted to declare conflicts of interest
at engagement creation; declarations are signed and ledger-anchored. The
system prevents a user from acting as auditor on an engagement where they
are registered as an AIMS owner. See
[14-impartiality-and-independence.md](14-impartiality-and-independence.md).

---

## Related Documents

- [02-getting-started.md](02-getting-started.md) — passkey enrollment and
  first engagement.
- [03-engagement-lifecycle.md](03-engagement-lifecycle.md) — mode
  commitment and lifecycle stages.
- [appendix-glossary.md](appendix-glossary.md) — AIMS, engagement modes,
  finding categories.
- [../concepts/terminology.md](../concepts/terminology.md) — comprehensive
  cross-standard glossary.
