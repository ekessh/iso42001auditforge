# @auditforge/signing

Ed25519 detached-signature service with JCS (RFC 8785) canonicalization.

- `SoftwareSigningProvider` reads the private key from base64-encoded PKCS#8 DER (env `SIGNING_PRIVATE_KEY_BASE64`).
- `SigningProvider` is the swap point for PKCS#11 / KMS / WebAuthn-backed signers.
- `SigningService` produces self-verifying receipts compatible with the protect-mcp receipt shape (`payloadHash`, `prevHash`, `signature`, `signerId`, `signerKeyId`, `publicKeyBase64`, `algorithm`, `ts`).

License: BUSL-1.1
