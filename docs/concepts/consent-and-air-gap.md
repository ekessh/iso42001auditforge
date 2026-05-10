<!--
SPDX-License-Identifier: BUSL-1.1
-->
<!-- metadata
section: concepts
audience: auditor, operator, compliance-officer
adr: 0025
cross-refs:
  - docs/adr/0025-airgap-cloud-consent-guard.md
  - docs/operator-guide/13-air-gap-vs-cloud-LLM.md
  - docs/compliance/data-flows-and-dpa.md
-->

# Consent and Air-Gap

> This document explains the written consent flow for cloud LLM and
> the cloud provider guard that enforces it in code.

---

## The Default: Local LLM

AuditForge defaults to local LLM inference (Ollama / vLLM / llama.cpp)
for all tasks. Cloud LLM providers (Anthropic, OpenAI) are **not
contacted** unless:

1. The lead auditor has explicitly opted-in cloud LLM for the specific
   engagement, AND
2. Written auditee consent has been recorded in the consent registry.

This is enforced at the `LLMProviderService` layer, not just in the UI.
Even if a client calls the API directly, the cloud provider guard blocks
any inference request to a cloud provider without a valid consent record
for the engagement.

---

## Written Consent Flow

1. Lead auditor navigates to **Engagement Settings → LLM Configuration**.
2. Selects **Enable cloud LLM**.
3. The system presents the consent statement:
   > "Enabling cloud LLM will send portions of interview transcripts,
   > evidence extracts, and claim context to [Anthropic / OpenAI] for
   > inference. This data processing is governed by [Anthropic's / OpenAI's]
   > enterprise data processing agreement and your firm's DPA. Do you
   > have written consent from the auditee organization?"
4. The auditor confirms and selects the cloud provider(s).
5. The auditee organization's designated contact signs the consent
   electronically (via the auditee portal or a PDF upload).
6. The consent record is stored in `packages/consent-registry`, signed
   by the auditor's key, and ledger-anchored (`consent.cloud_llm_granted`
   event).

---

## The Cloud Provider Guard

The guard is in `packages/llm-provider/src/cloud-consent.guard.ts`.
Before any inference call to a cloud provider:

```
1. Check LLM_AIR_GAP_MODE env var. If true → reject immediately.
2. Fetch the engagement's consent record for this provider.
3. If no valid consent record → reject with ConsentRequiredError.
4. If consent record is present → allow.
```

The guard is called synchronously before the inference request is made.
It cannot be bypassed by the application code; it is a middleware in
the `LLMProviderService`.

---

## Consent Record Contents

| Field | Value |
|---|---|
| `engagement_id` | The engagement this consent covers |
| `provider` | `anthropic` or `openai` |
| `granted_by` | Auditor principal ID |
| `consenting_organization` | Auditee organization ID |
| `consent_text_hash` | SHA-256 of the consent statement text |
| `granted_at` | Timestamp |
| `signature` | Ed25519 signature by the auditor |
| `document_evidence_id` | Evidence vault ID of the signed consent PDF (optional) |

---

## Revoking Consent

The auditor can revoke cloud LLM consent at any time:

1. Navigate to **Engagement Settings → LLM Configuration → Revoke**.
2. All in-flight cloud inference jobs are cancelled.
3. Future inference falls back to local LLM immediately.
4. Revocation is ledger-anchored (`consent.cloud_llm_revoked` event).

Revocation does not delete prior invocation records. The
`llm_invocations` table retains all prior calls for audit defensibility.

---

## Air-Gap Mode

When `LLM_AIR_GAP_MODE=true` (operator-level setting):

- The cloud provider guard returns `AirGapModeError` for any cloud
  provider call, regardless of consent records.
- The UI does not show the cloud LLM opt-in option.
- The engagement-creation API returns an error if `llmCloudOptIn: true`
  is passed.

This cannot be overridden by the auditor — it is an operator-level
control.

---

## Cross-References

- [ADR-0025](../adr/0025-airgap-cloud-consent-guard.md) — guard
  design decision.
- [../operator-guide/13-air-gap-vs-cloud-LLM.md](../operator-guide/13-air-gap-vs-cloud-LLM.md)
  — operator trade-off analysis.
- [../compliance/data-flows-and-dpa.md](../compliance/data-flows-and-dpa.md)
  — DPA requirements.
