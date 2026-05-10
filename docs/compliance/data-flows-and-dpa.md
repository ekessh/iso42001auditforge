<!--
SPDX-License-Identifier: BUSL-1.1
-->

# Data Flows and DPA

> Data flow documentation for operators who need to sign Data Processing
> Agreements with auditee organizations.

---

## Data Categories Processed

| Category | Examples | Processing purpose | Retention |
|---|---|---|---|
| Interview transcripts | Text transcripts of audit interviews | Clause attribution; NC drafting | Engagement retention period |
| Audio recordings | WAV/MP3 of live interview sessions | Transcription (processed immediately; recording retained optionally) | Engagement retention period (or shorter if auditor deletes) |
| Evidence documents | PDFs, images, DOCX files uploaded as evidence | VLM claim extraction; chain-of-custody | Engagement retention period |
| Personal identifiers | Auditor/co-auditor names, emails | Authentication; audit trail; report signing | Account lifetime |
| AI model outputs | Claim extractions, NC drafts, coverage scores | Audit execution | Engagement retention period |
| LLM invocation records | Model, tokens, cost, prompt template version | Auditability; cost accounting | 7 years (regulatory) |

---

## Data Flow: Standard (Local LLM, Air-Gap)

```
Auditee participant (audio) → Browser → API → transcription-py (local)
                                     → vlm-py (local)
                                     → Postgres (RLS-isolated)
                                     → MinIO (encrypted)

No data leaves the operator's infrastructure.
```

---

## Data Flow: Cloud LLM Opt-In

```
Auditee participant (audio) → Browser → API → transcription-py (local)
                                            → Anthropic API (TLS)
                                              or OpenAI API (TLS)
                                            → Postgres (RLS-isolated)
                                            → MinIO (encrypted)

Data sent to cloud: claim context (claim text + surrounding claims),
not raw audio. Audio transcription uses local WhisperX by default.
```

When cloud LLM is enabled:

- **Anthropic**: data is processed under Anthropic's enterprise DPA.
  Standard Contractual Clauses (SCCs) are available via Anthropic's
  legal team for EU/UK data transfers.
- **OpenAI**: data is processed under OpenAI's enterprise DPA. SCCs
  available via OpenAI's legal team.

---

## Sub-Processor List

| Sub-processor | Role | Location | DPA mechanism |
|---|---|---|---|
| Anthropic | Cloud LLM inference (opt-in) | United States | SCCs (EU/UK); operator must execute |
| OpenAI | Cloud LLM inference (opt-in) | United States | SCCs (EU/UK); operator must execute |
| Object storage provider | Evidence vault (MinIO if self-hosted; AWS S3 / Azure Blob if cloud) | Operator-chosen | Operator's own DPA with cloud provider |
| TSA provider | RFC 3161 timestamping | FreeTSA (Switzerland) or DigiCert (US) | No personal data transmitted; only hash values |

---

## Data Subject Rights

AuditForge does not provide a self-service GDPR/CCPA rights portal for
auditee participants. Operators must:

1. Handle data subject requests (access, deletion, portability) manually.
2. For deletion requests: use the engagement archival and deletion tools
   (operator API) to remove the engagement and evidence vault contents.
   Note: audit ledger events are cryptographically immutable — deleted
   evidence cannot remove its hash from the ledger, but the content is
   deleted.
3. For access requests: export the engagement data via the operator API
   and provide to the data subject.

---

## Related Documents

- [dpia-template.md](dpia-template.md) — DPIA template.
- [../concepts/consent-and-air-gap.md](../concepts/consent-and-air-gap.md)
  — consent mechanism.
- [../operator-guide/13-air-gap-vs-cloud-LLM.md](../operator-guide/13-air-gap-vs-cloud-LLM.md)
  — air-gap trade-off.
