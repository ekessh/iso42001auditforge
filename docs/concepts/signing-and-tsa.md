<!--
SPDX-License-Identifier: BUSL-1.1
-->
<!-- metadata
section: concepts
audience: developer, compliance-officer
adr: 0020
cross-refs:
  - docs/adr/0020-hash-chained-ledger-ed25519-tsa.md
  - docs/auditor-guide/12-reports-and-signing.md
  - docs/concepts/audit-ledger.md
-->

# Signing and TSA

> Cryptographic walkthrough of Ed25519 signing, JCS canonicalization,
> and RFC 3161 timestamping as used in AuditForge.

---

## Why Ed25519

Ed25519 (RFC 8032) was chosen over ECDSA-P256 and RSA-PSS because:

- **Deterministic** — no per-signature random nonce required. Identical
  inputs produce identical signatures; important for reproducible chain
  verification.
- **Small signatures** — 64 bytes vs 72+ for P-256 ECDSA vs 256+ for
  RSA.
- **No parameter choices** — P-256 and RSA have algorithm parameters
  that can be misused; Ed25519 has none.
- **NIST-approved** — FIPS 186-5 includes Ed25519.

---

## JCS Canonicalization

Before signing, the payload is canonicalized using JSON Canonicalization
Scheme (JCS, RFC 8785). JCS produces a deterministic byte representation
of JSON regardless of key ordering and whitespace.

```
payload = { "engagementId": "abc", "status": "created" }
canonical = jcs(payload)  # bytes, keys sorted, no extra whitespace
payload_hash = sha256(canonical)
signature = Ed25519.sign(private_key, payload_hash)
```

Without JCS, a JSON payload with a different key order would produce a
different hash even if the logical content is identical, breaking
cross-platform verification.

JCS is implemented in `packages/signing/src/jcs.ts`.

---

## Signing Flow

```
1. Service calls AuditLedgerService.emit({ type, payload, tenantId })
2. LedgerService fetches prev_hash (last event's signature for tenant)
3. LedgerService calls SigningService.sign(payload_hash)
4. SigningProvider (SoftwareSigningProvider or KMS) returns signature
5. LedgerService inserts the event row
6. For report.publish: LedgerService calls TSAClient.timestamp(payload_hash)
7. TSAClient returns RFC 3161 token
8. LedgerService updates the event row with tsa_token
```

---

## RFC 3161 Timestamping

RFC 3161 (Trusted Timestamping) provides an external, independent
attestation of when data existed. The flow:

```
1. AuditForge computes hash_to_timestamp = sha256(event_payload_hash)
2. AuditForge sends TimestampRequest to TSA:
   { hashAlgorithm: sha256, messageImprint: hash_to_timestamp,
     nonce: random, certReq: true }
3. TSA signs a TimestampToken containing the hash + genTime + TSA certificate
4. AuditForge stores the DER-encoded TimestampToken in the event row
```

Verification:

```
1. Parse the TimestampToken to extract genTime and hash
2. Recompute hash_to_timestamp from the event payload
3. Verify hash matches the token's messageImprint
4. Verify the TSA's signature on the token using the TSA's certificate
5. Assert genTime is within ±60 seconds of event.signed_at
```

The verifier does **not** need to contact the TSA at verification time —
the token is self-contained once the TSA's certificate chain is
available.

---

## Key Storage

| Environment | Key storage | Mechanism |
|---|---|---|
| Development | `SoftwareSigningProvider` in-process | Ed25519 private key from `SIGNING_PRIVATE_KEY_BASE64` env var |
| Production (recommended) | HSM or KMS | `PKCS11SigningProvider` (YubiHSM 2, AWS KMS, Azure Key Vault) |

The `SoftwareSigningProvider` must **never** be used in production. CI
Semgrep rule `software-signing-in-prod.yml` detects production use.

---

## Long-Term Signature Validity

Ed25519 signatures do not have an expiry, but the algorithm could
theoretically become weak over a 10+ year horizon. Mitigation:

- **Annual TSA re-timestamping**: the TSA token is renewed each year
  using a new (stronger) hash algorithm if needed.
- **CAdES-LT / PAdES-LTV**: for issued reports, the archived PDF/A-3
  carries CAdES-LT (long-term validation data) with multiple TSA tokens
  and OCSP/CRL responses, ensuring the signature can be validated
  decades later.

---

## Cross-References

- [ADR-0020](../adr/0020-hash-chained-ledger-ed25519-tsa.md) —
  algorithm selection rationale.
- [audit-ledger.md](audit-ledger.md) — how signing fits into the chain.
- [../auditor-guide/12-reports-and-signing.md](../auditor-guide/12-reports-and-signing.md)
  — auditor perspective on report signing.
- `packages/signing/src/` — signing source code.
- `packages/tsa/src/` — TSA client source code.
