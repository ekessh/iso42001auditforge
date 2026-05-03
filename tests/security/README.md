# Security tests

| Suite | Coverage |
|---|---|
| `injection-payloads.test.ts` | SQL, NoSQL, OS cmd, XSS, SSRF, template injection corpus |
| `rbac-matrix.test.ts` | 9 roles x 10 endpoints exhaustive allow/deny |
| `tenant-isolation.test.ts` | 200+ cross-tenant fuzz attempts |
| `file-upload-abuse.test.ts` | Path traversal, MIME spoof, zip-bomb, EICAR header recognition |
| `jwt-attacks.test.ts` | alg=none rejection, HS/RS confusion, empty signature |
| `probe-sandbox-escape.test.ts` | Egress allowlist enforcement |
| `signature-tamper.test.ts` | Mutation, truncation, append detection |

Run: `pnpm --filter @auditforge/security-tests test`. ZAP baseline + Semgrep run via CI workflows.
