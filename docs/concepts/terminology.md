<!--
SPDX-License-Identifier: BUSL-1.1
-->
<!-- metadata
section: concepts
audience: auditor, developer, compliance-officer
cross-refs:
  - docs/auditor-guide/appendix-glossary.md
  - ISO 42001:2023
  - NIST AI RMF 1.0
  - EU AI Act Regulation 2024/1689
-->

# Terminology

> Comprehensive cross-standard glossary. For AuditForge-specific
> implementation terms, see also
> [../auditor-guide/appendix-glossary.md](../auditor-guide/appendix-glossary.md).

---

## ISO/IEC 42001:2023 Terms

| Term | ISO 42001 §3 definition | AuditForge implementation |
|---|---|---|
| **AI system** | An engineered system that generates outputs such as content, predictions, recommendations, or decisions influencing real or virtual environments (§3.1) | Represented in the AI System Inventory; each system has its own probe scope |
| **AI Management System (AIMS)** | A management system for managing AI-related risks and opportunities (§3.2) | The subject of every engagement; AuditForge also manages its own AIMS |
| **Intended use** | The use for which the AI system is designed, validated, and intended (§3.6) | Captured in the AI System Inventory; scope of probe applicability |
| **Impact assessment** | A process to evaluate potential effects of the AI system on individuals, society, and the environment (§3.7) | Mapped to `P-RISK-*` probe category |
| **Objectives** | Results to be achieved (§3.9) | Evidenced through the claim graph; coverage tracks objective-related clauses |
| **Interested parties** | People or organizations that can affect, be affected by, or perceive themselves to be affected by a decision or activity (§3.10) | Stakeholder registry in the engagement |

---

## ISO/IEC 17021-1:2015 Terms

| Term | Definition | AuditForge relevance |
|---|---|---|
| **Conformity assessment body (CAB)** | Body that performs conformity assessment services | The firm operating AuditForge in Audit Mode |
| **Certification body (CB)** | CAB that operates certification schemes | AuditForge requires CB affiliation for Audit Mode report signing |
| **Impartiality** | Presence of objectivity; actual, perceived, or potential conflicts of interest are managed (§3.2) | Enforced via the conflict-of-interest declaration system |
| **Audit programme** | Set of one or more audits planned for a specific time frame and directed towards a specific purpose (§3.5) | An AuditForge engagement; programme managed in the engagement lifecycle |
| **Audit plan** | Description of activities and arrangements for an audit (§3.6) | Created in the `planning` lifecycle stage |
| **Audit evidence** | Records, statements of fact or other information relevant to the audit criteria and verifiable (§3.8) | Stored in the evidence vault; chain-of-custody enforced |
| **Audit finding** | Results of evaluating the collected audit evidence against audit criteria (§3.9) | Formal finding after auditor promotion |
| **Audit conclusion** | Outcome of an audit, after consideration of the audit objectives and all audit findings (§3.10) | Written by the auditor in the report conclusion section; never by the engine |
| **Non-conformity** | Non-fulfilment of a requirement (§3.11) | Major NC or minor NC in AuditForge |

---

## NIST AI RMF 1.0 Terms

| Term | Definition | AuditForge mapping |
|---|---|---|
| **Govern** | Policies, processes, procedures, and practices in place to manage AI risk (AI RMF Core) | `P-GOV-*` probe category |
| **Map** | Categorize and frame AI risks, using context, prior knowledge, and stakeholder perspectives | Claim graph + coverage matrix |
| **Measure** | Quantify AI risks using tools and methodologies | `P-RISK-*` + `P-DATA-*` probes |
| **Manage** | Prioritize and address AI risks based on measurement | CAPA tracking |
| **AI trustworthiness characteristics** | Accurate, explainable, interpretable, privacy-enhanced, reliable, safe, secure, fair, accountable (NIST AI RMF §2) | Probe categories map to these characteristics |

---

## EU AI Act (Regulation 2024/1689) Terms

| Term | Article | AuditForge relevance |
|---|---|---|
| **AI system** | Art. 3(1) | Aligned with ISO 42001 §3.1; AuditForge uses ISO 42001 definition |
| **High-risk AI system** | Art. 6 + Annex III | Determines probe intensity; high-risk AIMSs get the full probe suite |
| **Conformity assessment** | Art. 43 | Formal certification audit in Audit Mode |
| **Technical documentation** | Art. 11 + Annex IV | Evidenced through document review and P-GOV probes |
| **Transparency** | Art. 13 | `llm_invocations` log provides model-level transparency; EU AI Act Art. 13 cited in ADR-0011 |
| **Human oversight** | Art. 14 | Auditor-confirmation gate is the human oversight implementation |
| **Post-market monitoring** | Art. 72 | Surveillance engagement type |
| **DPIA-like impact assessment** | Art. 10 (data governance) | `docs/compliance/dpia-template.md` |

---

## OWASP LLM Top 10 Terms

| Item | Description | AuditForge probe |
|---|---|---|
| LLM01 | Prompt Injection | P-LLM-01 |
| LLM02 | Insecure Output Handling | P-LLM-02 |
| LLM03 | Training Data Poisoning | P-DATA-01 |
| LLM04 | Model Denial of Service | P-LLM-04 |
| LLM05 | Supply Chain Vulnerabilities | P-CHAIN-01 |
| LLM06 | Sensitive Information Disclosure | P-LLM-06 |
| LLM07 | Insecure Plugin Design | P-MCP-01 through P-MCP-08 |
| LLM08 | Excessive Agency | P-AGENT-01 |
| LLM09 | Overreliance | P-GOV-02 |
| LLM10 | Model Theft | P-CHAIN-02 |

---

## AuditForge-Specific Terms

See [../auditor-guide/appendix-glossary.md](../auditor-guide/appendix-glossary.md)
for: AIMS, audit mode, attribution, bi-temporal claim, CAPA, candidate
finding, claim, claim graph, coverage matrix, episode, engagement,
finding, JCS, mode, NC, OFI, probe, readiness mode, RFC 3161, SoA,
scope, TSA, tier router, working paper.
