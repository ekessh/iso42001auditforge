<!--
SPDX-License-Identifier: BUSL-1.1
-->

# Tutorial 03: Sign and Publish the Audit Report

> Walkthrough of the hash-chain anchoring, TSA timestamping, and
> receipt verification for an issued audit report.

---

## Prerequisites

- An engagement in `reporting` state with a rendered PDF.
- Your passkey (hardware key or platform authenticator) available.
- The QA checklist passed.

---

## Step 1: Final Review

1. Open the report in **Reports → Draft**.
2. Read through the entire report including:
   - Scope and objectives section.
   - Findings (major NCs, minor NCs, OFIs).
   - CAPA status summary.
   - Coverage summary.
   - Your conclusion text (you wrote this; verify it is complete and
     accurate).
3. Verify the PDF/A-3 badge appears in the report metadata panel.

---

## Step 2: Sign the Report

1. Click **Sign and Issue**.
2. The system presents the signing confirmation dialog:
   - Report SHA-256: `abc123…` (verify this matches the rendered PDF hash shown in the panel)
   - Signing key ID: `auditforge-key-001`
   - TSA: `https://freetsa.org/tsr`
3. Click **Confirm and Sign**.
4. Your browser's authenticator prompts for a WebAuthn gesture (Touch
   ID tap, hardware key tap, or PIN).
5. AuditForge:
   - Canonicalizes the report payload (JCS).
   - Signs with your Ed25519 key.
   - Sends the hash to the TSA.
   - Receives and stores the RFC 3161 timestamp token.
   - Writes the `report.publish` ledger event (signed and chained).
   - Transitions the engagement to `issued`.

This typically takes 3–10 seconds (TSA round-trip is the variable).

---

## Step 3: Download the Signed Report

1. Click **Download PDF/A-3**. The PDF is the signed audit file.
2. Click **Download DOCX**. The DOCX is the editable source (not signed
   separately; the PDF is the authoritative signed copy).
3. Click **Download Ledger Receipt**. This is a JSON file containing
   the ledger event for `report.publish`, including:
   - The report hash.
   - The Ed25519 signature.
   - The RFC 3161 timestamp token.

Share the PDF/A-3 with the auditee and accreditation body.

---

## Step 4: Verify the Report (Third-Party Verification)

Anyone (including the auditee) can verify the report independently:

```bash
# 1. Verify the Ed25519 signature
openssl pkeyutl -verify \
  -pubin -inkey firm-public-key.pem \
  -sigfile report.sig \
  -in report-hash.bin

# 2. Verify the RFC 3161 token
openssl ts -verify \
  -data report.pdf \
  -in report.tsr \
  -CAfile freetsa-cacert.pem

# 3. Verify the ledger chain (requires AuditForge API access)
curl -H "Authorization: Bearer $TOKEN" \
  https://auditforge.example.com/v1/admin/chain/verify-all
```

Alternatively, the `protect-mcp:verify-receipt` skill verifies a
single receipt file.

---

## Step 5: Long-Term Archival

For audits requiring 7+ year retention:

1. Navigate to **Engagement → Archive**.
2. Select **Archive with long-term TSA renewal**.
3. The system schedules annual TSA token renewal jobs.
4. The engagement enters the `archived` state.

---

## Related Documents

- [../auditor-guide/12-reports-and-signing.md](../auditor-guide/12-reports-and-signing.md)
  — signing concepts.
- [../concepts/signing-and-tsa.md](../concepts/signing-and-tsa.md) —
  cryptographic walkthrough.
- [../concepts/audit-ledger.md](../concepts/audit-ledger.md) — chain
  verification.
