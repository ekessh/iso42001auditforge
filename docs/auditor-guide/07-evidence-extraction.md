<!--
SPDX-License-Identifier: BUSL-1.1
-->

# Evidence Extraction

> This document explains how AuditForge uses VLM technology to extract
> structured claims from uploaded evidence files, and how the auditor
> confirms or rejects extracted claims.

---

## Supported File Types

| Format | Extraction path |
|---|---|
| PDF (text-based) | pdftotext → claim extraction via small LLM |
| PDF (scanned) | VLM OCR (Qwen2.5-VL or DeepSeek-OCR) |
| PNG / JPEG / TIFF | VLM OCR |
| DOCX / XLSX | LibreOffice convert → text → small LLM |
| MP4 / MKV (video) | Frame sampling → VLM + audio track → WhisperX |
| JSON / YAML (config / log exports) | Schema-aware text extraction |

All extraction is schema-constrained: the VLM cannot emit free-form
text; it must return a JSON payload conforming to the engagement's
entity and relation schema. Free-form LLM output is a bug (CLAUDE.md
hard rule).

---

## Upload Workflow

1. Navigate to **Evidence** in the left nav or the WP evidence drawer.
2. Click **Upload** or drag files onto the upload target.
3. AuditForge calls `POST /v1/evidence/uploads/presign` to get a
   presigned S3 URL.
4. The browser uploads the file directly to MinIO/S3.
5. The browser calls `POST /v1/evidence/uploads/finalize`. The API:
   - Creates an `evidence_files` row with status `pending_extraction`.
   - Enqueues an `evidence.extract` job in BullMQ.
   - Emits `evidence.uploaded` to the ledger.

---

## Extraction Pipeline

The BullMQ worker picks up the job and calls `services/vlm-py`:

```
Worker → gRPC ExtractClaims(bytes, entity_schema, relation_schema)
       ← Structured claims JSON (validated against schema)
```

The VLM sidecar (`services/vlm-py`) uses:

- **Qwen2.5-VL** (default local) for image-heavy documents.
- **DeepSeek-OCR** as an alternative for dense text scanning.
- Cloud VLM (opt-in per engagement with written consent).

The extracted JSON is validated against the engagement's schema registry
before writing to the claims table. Invalid payloads are rejected and
flagged for manual review; they do not enter the claim graph.

---

## Reviewing Extracted Claims

After extraction, the evidence file shows:

- **Extraction status**: `pending` / `complete` / `failed` / `manual_required`.
- **Extracted claims**: a list of atomic claims with entity type, relation
  type, payload, and confidence.
- **Suggested clause links**: the attribution engine proposes which
  clauses each claim covers.

The auditor reviews the list:

| Action | Effect |
|---|---|
| **Confirm claim + attribution** | Claim written to claim graph; coverage matrix updated; `claim.confirmed` ledger event |
| **Confirm claim, reject attribution** | Claim written without clause link; `claim.confirmed` + `attribution.rejected` ledger events |
| **Reject claim** | Claim not written; `claim.rejected` ledger event; reason required |
| **Edit claim** | Auditor amends the payload; `claim.edited` + `claim.confirmed` ledger events |

---

## Chain of Custody

Each evidence file has a chain-of-custody record:

- `sha256` of the uploaded file (computed at presign; re-verified at
  finalize).
- Uploader principal and timestamp.
- Extraction run details: VLM model, model hash (local) or version
  (cloud), prompt template version, latency.
- Auditor confirmation timestamps.

The chain-of-custody is part of the audit file and is included in the
evidence annex of the issued report.

---

## Failed Extraction

If extraction fails (VLM timeout, schema validation error, format not
supported):

1. The file status is set to `failed` with the error code.
2. The auditor is notified.
3. The auditor can:
   - **Retry** — re-queues the job.
   - **Manual extract** — opens the file in the built-in viewer and
     creates claims manually via the claim editor.
   - **Exclude** — marks the file as not extracted with a rationale;
     ledger event `evidence.excluded`.

---

## Related Documents

- [04-working-papers.md](04-working-papers.md) — linking evidence to WPs.
- [05-conversational-engine.md](05-conversational-engine.md) — how
  extracted claims feed into coverage.
- [../concepts/claim-graph.md](../concepts/claim-graph.md) — bi-temporal
  claim storage.
