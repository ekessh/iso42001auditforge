# @auditforge/tsa

RFC 3161 TimeStamp client.

- `Rfc3161HttpClient` — POSTs `application/timestamp-query` to a configurable TSA (`TSA_URL`, default `freetsa.org` for dev) and returns a `TimeStampToken` ({`tokenBase64`, `tsaUrl`, `issuedAt`, `hashAlgorithm`, `messageImprintHex`}).
- `StubTsaClient` — in-process deterministic stub for tests / air-gapped builds.
- `verify(token, expectedDigestHex)` extracts the SHA-256 messageImprint from the DER token and compares it byte-for-byte to the expected digest.

License: BUSL-1.1
