# ADR-0006: Hardware-Backed Signing of Audit Files (WebAuthn / Passkey / PKCS#11)

- **Status**: Accepted
- **Date**: 2026-05-03
- **Phase**: 0, 9, 12
- **Tags**: cryptography, signatures, archive

## Context

The audit report and archived audit file must be attributable to the lead auditor and resistant to repudiation, both at issuance and years later under accreditation review.

## Decision

The lead auditor binds a hardware-backed credential to their account at first login (WebAuthn / passkey, with PKCS#11 fallback for smart-card jurisdictions). At report issuance and archive freeze, the system requests a signature from that credential.

We produce CAdES-LT signatures for binary artifacts and PAdES-LTV signatures for PDFs, both embedded with TSA timestamp tokens. The archive verifier accepts long-term-validation extensions and renews them annually.

Multiple signers (peer reviewer, technical expert) co-sign where the audit type requires it.

## Consequences

### Positive
- Strong non-repudiation.
- Verifiable years later without trusting AuditForge as a service.
- eIDAS / ESIGN compatible.

### Negative
- Hardware key onboarding is friction; we ship a guided UX.
- Signature-renewal job must be reliable.
- Crypto code requires extra review (every PR).

### Neutral
- Software-only signing is available for non-production environments only.

## Alternatives Considered

| Option | Why rejected |
|--------|--------------|
| Server-held key | Service compromise = forged signatures retroactively. |
| Plain digital signature without TSA | Fails long-term verification. |
| Client-side certificate only | No widely deployed UX path; passkey better. |

## Compliance Implications

eIDAS Title III, ESIGN Act, ISO 17021-1 9.4.

## Follow-Ups

- [ ] WebAuthn enrollment UI.
- [ ] CAdES/PAdES library selection.
- [ ] Annual renewal job runbook.
