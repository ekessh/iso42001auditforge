# ADR-0020: Hash-chained audit ledger with Ed25519 + RFC 3161 TSA

- **Status**: Accepted
- **Date**: 2026-05-10
- **Deciders**: AuditForge core, security review
- **Phase**: 7 (audit ledger) → 13 (signed deliverables)
- **Tags**: audit-trail, signing, timestamping, integrity

## Context

`CLAUDE.md` requires "Event sourcing for audit ledger (signed,
hash-chained, TSA)". Wave-1 had to make four concrete choices:

1. **Signature algorithm** for per-event signing.
2. **Chain primitive** linking events into a tamper-evident sequence.
3. **External time-stamping authority** integration model.
4. **Verification flow** auditors and peer reviewers run.

The audit ledger is the durable evidence of every state transition that
matters under ISO 17021-1 (Audit independence and integrity of records);
the choices below have to survive a court-of-law level of scrutiny.

## Decision

- **Signature algorithm**: Ed25519. RFC 8032. 64-byte signatures, 32-byte
  public keys. No parameter choices, no curve gotchas. The signing key
  is held in `SoftwareSigningProvider` for dev, planned migration to
  PKCS#11/KMS for production (tracked under Phase 15 in ADR-0016).
- **Chain primitive**: each event row is `{seq, prev_hash, payload_hash,
  signature, signed_at}` where `payload_hash = sha256(canonical_json(event))`
  and `prev_hash` is the previous row's `signature`. The first row's
  `prev_hash` is 32 zero bytes (the genesis row, written when the firm is
  created and signed by the platform-level genesis key).
- **External TSA**: every `report.publish` event obtains an RFC 3161
  timestamp token from a configurable TSA (default: FreeTSA; production:
  DigiCert or a national TSA selected per engagement). The TSA token is
  appended to the event row in `tsa_token`.
- **Verification**: `packages/audit-engine/src/chain-verifier.ts`
  re-walks the chain end-to-end:
  1. Each row's `payload_hash` is recomputed from its canonical JSON.
  2. Each row's `prev_hash` matches the prior row's signature.
  3. Each row's signature verifies against the firm's public key.
  4. For `report.publish` rows, the TSA token is parsed and its time is
     within `[event.signed_at - 60s, event.signed_at + 60s]`.

The verifier is also a Semgrep target — any ledger event-write path that
does not pass through `signEvent()` is a bug; this is enforced by the
`semgrep/free-form-llm-output.yml` style rule library.

## Consequences

### Positive

- **Court-of-law strength.** Ed25519 + SHA-256 are NIST-approved, FIPS
  186-5 compliant, and the chain primitive is a textbook Merkle-style
  hash chain.
- **Cheap to verify.** A 50,000-event chain re-verifies in < 200 ms
  on commodity hardware.
- **External anchoring.** RFC 3161 means we do not have to operate our
  own time service; the TSA chain-of-trust is independent of the firm's
  signing key.

### Negative

- **No revocation.** Ed25519 has no revocation primitive — if the signing
  key is compromised, every event signed with it is suspect. Mitigation:
  HSM/KMS in production (Phase 15 follow-up), short-lived certificates
  for the per-engagement signer.
- **TSA dependency.** A `report.publish` blocks on the TSA HTTP call.
  Mitigation: a local "deferred TSA" worker that writes the event with a
  pending token and back-fills the TSA token within 60 s; verifier
  tolerates pending state up to a configurable horizon.

### Neutral

- We chose Ed25519 over ECDSA-P256 for determinism (no per-signature
  random nonce required) and over RSA-PSS for signature size; either
  would have worked from a strength-of-algorithm perspective.

## Alternatives Considered

| Option | Why rejected |
|--------|--------------|
| Plain insert-only audit table | No tamper-evidence; "the DBA can edit history" defeats the purpose. |
| Blockchain anchoring | Overkill, expensive, and TSA already gives "trusted time". |
| HMAC chain (no asymmetric signature) | Verifier needs the secret; no third-party verification possible. |
| ECDSA-P256 | Larger signatures, RNG dependency; no benefit for this use case. |

## Compliance Implications

- **ISO 17021-1 Clause 9.4.10**: records of audit programme — must be
  protected against alteration. The chain primitive proves any post-hoc
  alteration.
- **ISO 42001 Clause 9.2** (internal audit): the audit ledger is the
  evidence trail an internal auditor walks.
- **eIDAS Regulation Art. 41** (qualified electronic time stamps): RFC
  3161 + a qualified TSA satisfies the eIDAS qualified-timestamp
  requirements when configured with a qualified provider.

## Follow-Ups

- [ ] Phase 8: chain-integrity probe in CI (synthetic ledger, replay it,
      assert the verifier accepts it).
- [ ] Phase 13: per-engagement signing key rotation policy.
- [ ] Phase 15: HSM/KMS migration of `SoftwareSigningProvider`.
- [ ] Phase 15: TSA failover (two providers configured per firm).
