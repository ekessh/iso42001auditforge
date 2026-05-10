# AuditForge Audit-Evidence Runner

Defensive Python sidecar for the AuditForge ISO 42001 workbench. Runs the
catalogued, declarative ISO 42001 / NIST AI RMF / OWASP-LLM-Top-10 audit-evidence
checks against AI systems within a signed engagement scope.

## Safety boundary

This service is functionally equivalent to a financial auditor running the
firm's standard compliance procedures. It only exists to collect signed
evidence for an accredited certification report. It is **not** a red-team or
adversarial testing tool.

The sidecar refuses to run any check that:

- is not in the registered catalogue (404)
- arrives without a valid `engagementContext` JWT (401)
- targets a host outside the operator-configured egress allowlist
- attempts filesystem traversal outside its run-scoped `fs_root`
- exceeds any of the four declared budget axes (`max_seconds`, `max_calls`,
  `max_tokens`, `max_usd`)

There is no dynamic check loading. The check registry is populated at
import time and is read-only at runtime.

## Built-in catalogue

| ID         | Family       | Title                                |
| ---------- | ------------ | ------------------------------------ |
| AC-01      | authn        | Authorization-Required               |
| AC-02      | rate-limit   | Rate-Limit-Present                   |
| AC-03      | input        | Input-Length-Bounded                 |
| AC-04      | schema       | Output-Schema-Conformant             |
| AC-05      | pii          | PII-Redaction-Active                 |
| AC-06      | provenance   | Provenance-Headers                   |
| AC-07      | audit-log    | Audit-Log-Generated                  |
| P-MCP-01   | mcp          | Tool-Catalogue-Validation            |
| P-MCP-02   | mcp          | Server-Allowlist                     |
| P-MCP-03   | mcp          | Audit-Trail-Completeness             |
| P-MCP-04   | mcp          | Authentication-Mode                  |
| P-MCP-05   | mcp          | Per-Tool-RBAC                        |
| P-MCP-06   | mcp          | Resource-Provenance-Verification     |
| P-MCP-07   | mcp          | Cross-Server-Session-Isolation       |
| P-MCP-08   | mcp          | Gateway-Policy-Enforcement           |

## Develop

Requires Python 3.12+ and [uv](https://github.com/astral-sh/uv).

```bash
cd services/audit-evidence-runner
uv sync --extra dev
uv run uvicorn services.audit_evidence_runner.main:app --reload --port 8088
```

The server is then available at `http://127.0.0.1:8088`. `GET /healthz` and
`GET /checks/catalogue` are good first-touch endpoints.

## Test

```bash
uv run pytest
```

`pytest --cov-fail-under=80` is enforced; tests use respx to mock the auditee
HTTP target.

## Lint

```bash
uv run ruff check .
```

## Configuration

All settings are environment variables prefixed `AUDIT_RUNNER_`:

| Variable                                | Default                  | Description                                                               |
| --------------------------------------- | ------------------------ | ------------------------------------------------------------------------- |
| `AUDIT_RUNNER_HOST`                     | `0.0.0.0`                | Bind host                                                                 |
| `AUDIT_RUNNER_PORT`                     | `8088`                   | Bind port                                                                 |
| `AUDIT_RUNNER_EGRESS_PROXY`             | (empty)                  | Outbound proxy URL; empty = no egress unless `ALLOWED_HOSTS` is set      |
| `AUDIT_RUNNER_ALLOWED_HOSTS`            | (empty)                  | Comma-separated hostname allowlist (fnmatch patterns, e.g. `*.audit.test`)|
| `AUDIT_RUNNER_FS_ROOT`                  | `/tmp/auditforge-checks` | Root for run-scoped scratch dirs                                          |
| `AUDIT_RUNNER_ENGAGEMENT_JWT_SECRET`    | (empty)                  | Shared secret for HS256 verification (or PEM public key for RS256/ES256)  |
| `AUDIT_RUNNER_ENGAGEMENT_JWT_ALGORITHM` | `HS256`                  | JWT algorithm                                                             |
| `AUDIT_RUNNER_ENGAGEMENT_JWT_AUDIENCE`  | `auditforge-audit-evidence-runner` | Expected `aud` claim                                            |
| `AUDIT_RUNNER_ENGAGEMENT_JWT_ISSUER`    | `auditforge-api`         | Expected `iss` claim                                                      |
| `AUDIT_RUNNER_ENGAGEMENT_JWT_REQUIRED`  | `true`                   | Set to `false` only in trusted dev contexts                               |
| `AUDIT_RUNNER_SIGNING_ENDPOINT`         | (empty)                  | If set, results are signed via apps/api; else an in-process Ed25519 key   |
| `AUDIT_RUNNER_SIGNING_SIGNER_ID`        | `audit-evidence-runner`  | Signer id stamped on each result                                          |
| `AUDIT_RUNNER_MAX_CONCURRENT_RUNS`      | `8`                      | Cap on simultaneous runs                                                  |
