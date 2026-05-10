<!--
SPDX-License-Identifier: BUSL-1.1
-->

# Probes and Conformance Checks

> This document explains how to run the built-in conformance probe suite
> against the AIMS under audit.

For the full catalogue of probe IDs, descriptions, pass criteria, and
mapping to ISO 42001 Annex A controls, see
[../security/probe-catalogue.md](../security/probe-catalogue.md). This
document covers the operational aspects: triggering probes, interpreting
results, and linking outcomes to findings.

---

## Probe Categories

| Prefix | Category | Source framework |
|---|---|---|
| `AC-*` | Annex A controls (direct mapping) | ISO 42001:2023 Annex A |
| `P-LLM-*` | LLM-specific attacks and failure modes | OWASP LLM Top 10 |
| `P-MCP-*` | MCP protocol security | AuditForge MCP probe library |
| `P-DATA-*` | Data quality, lineage, poisoning | MITRE ATLAS, AVID |
| `P-RISK-*` | Risk management control verification | NIST AI RMF |
| `P-GOV-*` | Governance and documentation | ISO 42001 §6, §7, §9 |
| `P-AGENT-*` | Agentic AI workflow integrity | MITRE ATLAS |
| `P-CHAIN-*` | Supply chain and model provenance | AVID, MIT AI Risk Repo |

The probe runtime wraps `garak` (Apache-2.0), `PyRIT` (MIT), and
`HarmBench` (CAIS) for LLM-specific probes. MCP, governance, and supply
chain probes are native AuditForge implementations.

---

## Running a Probe

1. Navigate to **Probes** in the engagement sidebar.
2. Click **+ Add Probe**.
3. Select the probe from the catalogue (searchable by ID, category, or
   clause mapping).
4. Configure the probe:
   - **Target**: the AI system endpoint or model handle from the AI System
     Inventory.
   - **Parameters**: probe-specific settings (injection payload list,
     sample count, pass threshold).
   - **Budget**: estimated LLM token cost (for cloud-opt-in engagements).
5. Click **Queue Execution** (`POST /v1/probes/{id}/execute`). The job
   is enqueued in BullMQ and executed in `services/probe-runner-py`.

---

## Interpreting Results

Probe results are displayed in the **Probe Results** panel:

| Status | Meaning |
|---|---|
| `pass` | The AIMS met the probe's pass criteria. |
| `fail` | The AIMS did not meet pass criteria. A candidate finding is drafted. |
| `inconclusive` | Probe ran but result is ambiguous (e.g. endpoint throttled). Auditor investigates manually. |
| `error` | Probe failed to run. See the error log. |

For `fail` results, the NC drafter automatically generates a candidate
finding with:

- The probe ID and version.
- The specific failure evidence (payload, response, diff from expected).
- The clause mapping.
- Suggested severity.

The auditor reviews and promotes or dismisses the candidate finding.

---

## MCP-Specific Probes (P-MCP-01 through P-MCP-08)

These probes assess AI systems that expose MCP tool servers:

| Probe | What it checks |
|---|---|
| `P-MCP-01` | Tool poisoning: MCP tool descriptions manipulate the AI's behavior |
| `P-MCP-02` | Server allowlist: only approved MCP servers are reachable |
| `P-MCP-03` | Audit trail completeness: all tool calls appear in the audit log |
| `P-MCP-04` | Authentication mode: mTLS or token auth enforced |
| `P-MCP-05` | Per-tool RBAC: fine-grained permissions enforced |
| `P-MCP-06` | Indirect prompt injection via MCP resources |
| `P-MCP-07` | Cross-server session isolation |
| `P-MCP-08` | Gateway policy enforcement |

To run MCP probes, the AI system must expose its MCP server URL during
the probe configuration step. AuditForge connects to the MCP server
directly; it does not require agent-level access to the auditee's
infrastructure unless otherwise scoped.

---

## Linking Probe Results to Findings

Probe results can be linked to findings in two ways:

1. **Automatic (via NC drafter)**: `fail` results generate candidate
   findings automatically. The auditor promotes or dismisses.
2. **Manual**: Open a probe result and click **Link to Finding**. Select
   an existing candidate finding or create a new one.

Evidence from probe results (payloads, responses, diff output) is stored
in the evidence vault and attached to the finding.

---

## Probe Budget and LLM Cost Control

LLM-based probes consume tokens. Before running a batch:

1. Check the **Probe Budget** panel
   (`GET /v1/probes/budget/{engagementId}`).
2. The panel shows estimated cost per probe.
3. Set a per-engagement LLM budget cap in **Engagement Settings**.
4. When the cap is approached, the system falls back to the local LLM
   tier automatically. If no local LLM can run the probe, the job is
   queued with `awaiting_budget_approval` status.

---

## Related Documents

- [../security/probe-catalogue.md](../security/probe-catalogue.md) —
  full probe specifications.
- [09-findings-workflow.md](09-findings-workflow.md) — what happens after
  a probe fails.
- [05-conversational-engine.md](05-conversational-engine.md) — NC drafter
  that processes probe failures.
