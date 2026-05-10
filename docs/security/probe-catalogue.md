<!-- SPDX-License-Identifier: BUSL-1.1 -->

# AuditForge Conformance Probe Catalogue

This catalogue lists every declarative ISO/IEC 42001 conformance check
shipped in `services/audit-evidence-runner/` and the matching TS probe
adapter in `packages/probe-engine/src/checks/*-pack.ts`. **Every check is
declarative and deterministic** — no offensive testing, no
unauthenticated probing. Each check requires the auditee's written
authorization, an in-scope agreement, and a signed engagement context.

## Versioning

> Catalogue changes (adding, removing, or re-categorising a check, or
> changing its `clause_refs`) require **external lead-auditor review**
> per CLAUDE.md per-phase gate 3 ("External lead auditor review for any
> new question library content"). Internal phrasing tweaks may proceed
> via normal review.

The catalogue version is the git SHA of this file. The runtime catalogue
exposed at `GET /checks/catalogue` always agrees with the latest checks/
modules registered at sidecar startup.

## Taxonomy

| Family   | Sidecar prefix | TS probe prefix | Count | Focus                                  |
| -------- | -------------- | --------------- | ----- | -------------------------------------- |
| Generic  | `AC-`          | `P-AEAC-`       | 7     | Generic API access-control evidence    |
| MCP      | `P-MCP-`       | `P-AEMCP-`      | 8     | Model Context Protocol conformance     |
| LLM      | `P-LLM-`       | `P-AELLM-`      | 10    | LLM behaviour conformance              |
| Data     | `P-DATA-`      | `P-AEDATA-`     | 8     | Data lifecycle conformance             |
| Risk     | `P-RISK-`      | `P-AERISK-`     | 6     | Risk treatment evidence                |
| Gov      | `P-GOV-`       | `P-AEGOV-`      | 6     | Governance evidence                    |
| Agent    | `P-AGENT-`     | `P-AEAGENT-`    | 5     | Single-agent autonomy conformance      |
| Chain    | `P-CHAIN-`     | `P-AECHAIN-`    | 5     | Multi-step agent chain conformance     |
| **Total**|                |                 | **55** |                                       |

## Common authorization

Every check requires:

- A signed `engagement_context` JWT issued by the AuditForge API. The
  sidecar verifies the JWT (HS256 in dev, RS256 in production) before
  any HTTP call leaves the runner.
- Network sandbox configuration that explicitly allowlists the auditee
  hosts the check will reach.
- Written auditee authorization captured at engagement creation; the
  signed `audit-charter.pdf` is hashed and pinned to the run record.

## Common budget guidance

Each check declares a budget shape; defaults below.

| Axis         | Default | Cap        | Notes                                         |
| ------------ | ------- | ---------- | --------------------------------------------- |
| max_seconds  | 30      | 3,600      | wall-clock cap                                |
| max_calls    | 200     | 100,000    | first axis to trip terminates the run         |
| max_tokens   | 10,000  | 100M       | cost cap; LLM checks count tokens explicitly  |
| max_usd      | 1.00    | 10,000     | cloud-LLM checks only                         |

## Check entries

Each entry shows `Check ID` (sidecar), the auditor-facing **Title**, the
`clause_refs` list, the evidence the check produces, the auditee
authorization required, and the severity calibration. Sample inputs are
JSON snippets to paste into the run-request `params` field.

---

### Generic API access control (AC-01 .. AC-07)

Existing Wave-4 checks. Refer to
`packages/probe-engine/src/checks/standard-evidence-pack.ts` for the TS
descriptors. Each maps to ISO/IEC 42001 8.3 (operational controls) plus
selected Annex A controls.

### MCP conformance (P-MCP-01 .. P-MCP-08)

Existing Wave-4 checks. Refer to
`packages/probe-engine/src/checks/mcp-conformance/` for TS descriptors.
Maps to ISO/IEC 42001 7.5 + 8.3 + Annex A.6.2.7, A.6.2.8, A.7.4, A.10.3.

---

### LLM behaviour conformance (P-LLM-01 .. P-LLM-10)

#### P-LLM-01 LLM System-Prompt-Frozen

- **Clauses:** ISO/IEC 42001 7.5, 8.2; Annex A.6.2.7, A.6.2.8.
- **External:** NIST AI RMF MEASURE-2.7.
- **Severity:** high.
- **Evidence:** N response headers carrying the documented system-prompt
  fingerprint header; pass record stores the fingerprint hash.
- **Authorization:** auditee documents the fingerprint header name and
  permits N requests to the documented inference endpoint.
- **Budget:** 3 calls default.
- **Sample input:**
  ```json
  {
    "sample_count": 3,
    "fingerprint_header": "x-system-prompt-hash"
  }
  ```

#### P-LLM-02 LLM Output-Length-Bounded

- **Clauses:** ISO/IEC 42001 8.3; Annex A.6.2.5.
- **Severity:** medium.
- **Evidence:** observed response length vs. documented cap.
- **Authorization:** auditee permits one prompt expected to over-run.
- **Sample input:** `{ "documented_max_chars": 4000 }`

#### P-LLM-03 LLM Refusal-On-Documented-Out-Of-Scope

- **Clauses:** ISO/IEC 42001 6.1.4, 8.3; Annex A.6.2.5, A.9.4.
- **Severity:** high.
- **Evidence:** out-of-scope prompts produce a documented refusal token.
- **Authorization:** auditee supplies the prompts AND documented refusal
  markers.
- **Sample input:**
  ```json
  {
    "out_of_scope_prompts": ["..."],
    "refusal_markers": ["I cannot", "out of scope"]
  }
  ```

#### P-LLM-04 LLM Determinism-At-Zero-Temp

- **Clauses:** ISO/IEC 42001 8.3, 9.1; Annex A.6.2.4.
- **Severity:** medium.
- **Evidence:** Levenshtein distance between two zero-temp completions.
- **Sample input:** `{ "tolerance_chars": 0 }`

#### P-LLM-05 LLM Citation-Present

- **Clauses:** ISO/IEC 42001 7.5; Annex A.7.5, A.8.2; EU AI Act Article 13.
- **Severity:** medium.
- **Evidence:** number of citation entries in the response payload.
- **Sample input:** `{ "min_citations": 1, "citations_path": ["citations"] }`

#### P-LLM-06 LLM No-Training-Data-Leakage

- **Clauses:** ISO/IEC 42001 8.3; Annex A.7.4, A.7.5; OWASP LLM Top-10 LLM06.
- **Severity:** high.
- **Evidence:** zero exact-matches of auditee-supplied fingerprints.
- **Authorization:** auditee supplies the canary prompt AND fingerprints.
- **Sample input:**
  ```json
  { "canary_prompt": "...", "fingerprints": ["secret-canary-string"] }
  ```

#### P-LLM-07 LLM Provider-Switching-Stability

- **Clauses:** ISO/IEC 42001 6.1.3, 8.3; Annex A.6.2.5, A.10.3.
- **Severity:** high.
- **Evidence:** documented fallback path returns 200 with the secondary
  provider header.
- **Sample input:**
  ```json
  { "expected_secondary": "secondary", "fallback_header": "x-fallback-trigger" }
  ```

#### P-LLM-08 LLM Cost-Cap-Per-Request

- **Clauses:** ISO/IEC 42001 8.3; Annex A.6.2.6, A.10.3.
- **Severity:** medium.
- **Evidence:** documented cost cap terminates the request with HTTP
  402/413/429 (configurable).

#### P-LLM-09 LLM Inference-Latency-Bounded

- **Clauses:** ISO/IEC 42001 8.3, 9.1; Annex A.6.2.6.
- **Severity:** low.
- **Evidence:** cold + warm latency under the documented SLA.

#### P-LLM-10 LLM Model-Version-Pinned

- **Clauses:** ISO/IEC 42001 7.5, 8.3; Annex A.6.2.7.
- **Severity:** high.
- **Evidence:** response includes the documented model-version header
  matching the auditee's pin.

---

### Data lifecycle conformance (P-DATA-01 .. P-DATA-08)

#### P-DATA-01 Training-Data-Provenance

- **Clauses:** ISO/IEC 42001 7.5; Annex A.7.2, A.7.5.
- **Severity:** high.
- **Evidence:** dataset metadata returns source, license, collection_date,
  version, integrity_hash.

#### P-DATA-02 Data-Subject-Rights

- **Clauses:** ISO/IEC 42001 7.5, 8.3; Annex A.7.4; EU AI Act Article 26;
  GDPR Article 15.
- **Severity:** high.
- **Evidence:** enumerate, rectify, erase endpoints return documented
  success status for a synthetic subject id.
- **Authorization:** auditee provisions a synthetic data-subject record.

#### P-DATA-03 Data-Quality-Metrics-Logged

- **Clauses:** ISO/IEC 42001 7.5, 9.1; Annex A.7.4, A.7.6.
- **Severity:** medium.
- **Evidence:** completeness, validity, freshness metrics present in the
  pipeline metrics endpoint for the latest run.

#### P-DATA-04 PII-Tagging-On-Ingestion

- **Clauses:** ISO/IEC 42001 7.5, 8.3; Annex A.7.4.
- **Severity:** high.
- **Evidence:** persisted record carries PII tags on the documented
  fields.

#### P-DATA-05 Retention-Schedule-Active

- **Clauses:** ISO/IEC 42001 7.5, 8.3; Annex A.7.4, A.7.6; GDPR Art. 5.
- **Severity:** high.
- **Evidence:** active store contains zero records older than the
  documented retention age.

#### P-DATA-06 Cross-Border-Transfer-Documented

- **Clauses:** ISO/IEC 42001 7.5; Annex A.7.5, A.10.3; GDPR Chapter V; EU
  AI Act Article 25.
- **Severity:** high.
- **Evidence:** residency markers contain only auditee-allowlisted
  regions.

#### P-DATA-07 Synthetic-Data-Disclosure

- **Clauses:** ISO/IEC 42001 7.5; Annex A.7.5, A.7.6; EU AI Act Article 50.
- **Severity:** medium.
- **Evidence:** every synthetic dataset carries `synthetic`,
  `generation_method`, `validation_basis` fields.

#### P-DATA-08 Dataset-Versioning

- **Clauses:** ISO/IEC 42001 7.5, 8.3; Annex A.7.5, A.6.2.7.
- **Severity:** high.
- **Evidence:** dataset version pin in production matches the latest
  model card pin.

---

### Risk treatment evidence (P-RISK-01 .. P-RISK-06)

#### P-RISK-01 Risk-Register-Reviewed

- **Clauses:** ISO/IEC 42001 6.1.2, 9.3; Annex A.5.2.
- **Severity:** high.
- **Evidence:** every risk-register entry has been reviewed within the
  documented review period.

#### P-RISK-02 High-Risk-Treatment-Plan-Closed

- **Clauses:** ISO/IEC 42001 6.1.3, 8.3; Annex A.5.4.
- **Severity:** high.
- **Evidence:** every high-risk item has a closed treatment plan with an
  effectiveness check.

#### P-RISK-03 Mitigation-Effectiveness-Test

- **Clauses:** ISO/IEC 42001 6.1.3, 9.1; Annex A.5.4.
- **Severity:** high.
- **Evidence:** each high-risk mitigation tested within the documented
  retest cycle.

#### P-RISK-04 Residual-Risk-Acknowledged

- **Clauses:** ISO/IEC 42001 5.1, 6.1.3; Annex A.3.2.
- **Severity:** high.
- **Evidence:** every residual risk has an explicit acknowledgement
  signed by an accountable owner.

#### P-RISK-05 Change-Triggered-Re-Assessment

- **Clauses:** ISO/IEC 42001 6.3, 8.2; Annex A.5.2.
- **Severity:** high.
- **Evidence:** documented significant change triggered a re-assessment
  within the documented SLA.

#### P-RISK-06 Risk-Appetite-Defined

- **Clauses:** ISO/IEC 42001 5.2, 6.1.2, 9.3; Annex A.2.2.
- **Severity:** medium.
- **Evidence:** risk-appetite endpoint returns a current statement
  matching the latest management-review id.

---

### Governance evidence (P-GOV-01 .. P-GOV-06)

#### P-GOV-01 AIMS-Scope-Statement

- **Clauses:** ISO/IEC 42001 4.3, 5.1; Annex A.2.2.
- **Severity:** high.
- **Evidence:** scope endpoint returns the canonical version with
  leadership-approval timestamp.

#### P-GOV-02 Roles-And-Responsibilities

- **Clauses:** ISO/IEC 42001 5.3; Annex A.3.2.
- **Severity:** medium.
- **Evidence:** documented roles each carry a named owner + reachable
  contact.

#### P-GOV-03 Resource-Allocation-Approved

- **Clauses:** ISO/IEC 42001 7.1; Annex A.4.2, A.4.5.
- **Severity:** medium.
- **Evidence:** allocations record references the latest plan id.

#### P-GOV-04 Communication-Records

- **Clauses:** ISO/IEC 42001 7.4; Annex A.8.3, A.8.5.
- **Severity:** medium.
- **Evidence:** comms log exposes both internal + external entries.

#### P-GOV-05 Document-Control

- **Clauses:** ISO/IEC 42001 7.5, 7.5.3; Annex A.6.2.7.
- **Severity:** medium.
- **Evidence:** controlled-document change records carry signer +
  signature.

#### P-GOV-06 Continual-Improvement-Backlog

- **Clauses:** ISO/IEC 42001 10.1, 10.2; Annex A.2.4.
- **Severity:** low.
- **Evidence:** improvement-backlog items each carry status + owner.

---

### Agent autonomy conformance (P-AGENT-01 .. P-AGENT-05)

#### P-AGENT-01 Agent Authorization-Scope-Bounded

- **Clauses:** ISO/IEC 42001 8.3; Annex A.6.2.5, A.9.4.
- **Severity:** high.
- **Evidence:** agent rejects sample documented out-of-scope action
  requests with HTTP 403/422.

#### P-AGENT-02 Agent Tool-Manifest-Frozen

- **Clauses:** ISO/IEC 42001 7.5, 8.3; Annex A.6.2.7.
- **Severity:** high.
- **Evidence:** sha256 of the served tool list matches the documented
  manifest hash.

#### P-AGENT-03 Agent Human-In-Loop-Triggers

- **Clauses:** ISO/IEC 42001 8.3; Annex A.9.2, A.9.4.
- **Severity:** high.
- **Evidence:** documented HIL inputs cause the agent to suspend with
  `awaiting_review`.

#### P-AGENT-04 Agent Reversibility-Guarantees

- **Clauses:** ISO/IEC 42001 8.3; Annex A.6.2.5, A.9.2.
- **Severity:** medium.
- **Evidence:** documented reversal endpoint restores state to baseline
  after a documented action.

#### P-AGENT-05 Agent Failure-Mode-Logging

- **Clauses:** ISO/IEC 42001 9.1, 10.2; Annex A.6.2.8.
- **Severity:** medium.
- **Evidence:** recent agent error logs all carry a documented
  `failure_mode` tag.

---

### Chain conformance (P-CHAIN-01 .. P-CHAIN-05)

#### P-CHAIN-01 Chain Step-Boundary-Logging

- **Clauses:** ISO/IEC 42001 8.3, 9.1; Annex A.6.2.8.
- **Severity:** high.
- **Evidence:** each chain step has start/end timestamps + input/output
  hashes in the audit trail.

#### P-CHAIN-02 Chain Authorization-At-Each-Step

- **Clauses:** ISO/IEC 42001 8.3; Annex A.7.4.
- **Severity:** high.
- **Evidence:** each step record carries an `auth_check_id`.

#### P-CHAIN-03 Chain Idempotency-Keys-Honored

- **Clauses:** ISO/IEC 42001 8.3; Annex A.6.2.5, A.6.2.6.
- **Severity:** medium.
- **Evidence:** replaying the same chain twice with the same idempotency
  key returns the cached `chain_run_id`.

#### P-CHAIN-04 Chain Timeout-Bounded

- **Clauses:** ISO/IEC 42001 8.3; Annex A.6.2.5.
- **Severity:** medium.
- **Evidence:** timeout-trigger request returns the documented timeout
  status (default 408/504).

#### P-CHAIN-05 Chain Inter-Step-Sanitization

- **Clauses:** ISO/IEC 42001 8.3; Annex A.6.2.5.
- **Severity:** medium.
- **Evidence:** each step record references a `sanitization_id`.

---

## Hard rules cross-reference

CLAUDE.md hard rules enforced by code or static analysis:

- **Re-ranker outputs only clause IDs from the catalogue** — enforced by
  `semgrep/clause-id-validity.yml` + probe `P-AF-CLAUSE-01`.
- **Free-form LLM output is a bug** — `semgrep/free-form-llm-output.yml`
  + `semgrep/iso42001-conformance.yml` rule
  `af-iso42001-llm-call-without-schema`.
- **Candidate findings never visible to auditee** —
  `semgrep/auditee-cf-leak.yml` + `semgrep/iso42001-conformance.yml`
  rule `af-iso42001-cf-rbac-includes-auditee`.
- **Provider switching does not invalidate prior auditor decisions** —
  this catalogue's P-LLM-07 verifies the auditee's documented fallback
  semantically, never silently retries against a fresh provider.
- **AuditForge profiles itself in its own AI System Inventory** —
  enforced at runtime by `apps/api/src/modules/ai-inventory`; not a
  static check.
