<!--
SPDX-License-Identifier: BUSL-1.1
-->

# Configuration Reference

> Complete environment variable reference for all AuditForge services.
> Source: `.env.example` in the repository root plus service-level
> defaults. Variables marked **secret** must be injected from a secrets
> manager (Kubernetes Secret, Vault, AWS Secrets Manager); never commit
> them to version control.

---

## Variable Table

| Variable | Type | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | **secret** | — | Postgres connection string. Format: `postgres://user:pass@host:5432/db` |
| `SIGNING_PRIVATE_KEY_BASE64` | **secret** | — | Base64-encoded PKCS#8 DER Ed25519 private key (48 bytes). `SoftwareSigningProvider` only — replace with PKCS#11/KMS in production. |
| `SIGNING_KEY_ID` | config | `auditforge-dev-key-001` | Identifier for the signing key. Included in every ledger event's `key_id` field. |
| `TSA_URL` | config | `https://freetsa.org/tsr` | RFC 3161 timestamp authority endpoint. Use a qualified TSA (ETSI TS 119 612) for EU/UK auditors. |
| `LEDGER_ANCHOR_INTERVAL_MS` | config | `60000` | Milliseconds between TSA batch anchor attempts. Low-volume: each event is anchored individually. High-volume: events are batch-anchored at the chain head. |
| `REPORT_OUTPUT_DIR` | config | `./var/reports` | Filesystem path for rendered DOCX/PDF/A-3 bundles. Must be WORM or Object Lock in production. |
| `LLM_LOCAL_OLLAMA_BASE_URL` | config | `http://127.0.0.1:11434` | Ollama API base URL for local LLM inference. |
| `LLM_AIR_GAP_MODE` | config | `false` | When `true`, the cloud provider guard blocks all Anthropic/OpenAI calls regardless of per-engagement settings. |
| `REDIS_URL` | **secret** | — | Redis connection string. Format: `redis://:password@host:6379` |
| `MINIO_ENDPOINT` | config | `http://localhost:9000` | MinIO/S3 endpoint URL. |
| `MINIO_ACCESS_KEY` | **secret** | — | MinIO/S3 access key ID. |
| `MINIO_SECRET_KEY` | **secret** | — | MinIO/S3 secret access key. |
| `MINIO_BUCKET` | config | `auditforge-evidence` | S3 bucket name for the evidence vault. |
| `MEILISEARCH_HOST` | config | `http://localhost:7700` | Meilisearch API base URL. |
| `MEILISEARCH_MASTER_KEY` | **secret** | — | Meilisearch master key. |
| `SESSION_SECRET` | **secret** | — | 32-byte random hex string for session cookie HMAC. |
| `NEXTAUTH_SECRET` | **secret** | — | Auth.js / NextAuth.js secret. Required by `apps/web`. |
| `NEXTAUTH_URL` | config | `http://localhost:3000` | Canonical URL of the Next.js app. Required for OAuth redirect URIs. |
| `API_BASE_URL` | config | `http://localhost:4000` | Internal API base URL used by the Next.js server-side. |
| `WEBAUTHN_RPID` | config | `localhost` | WebAuthn Relying Party ID. Must match the domain without scheme. |
| `WEBAUTHN_RP_NAME` | config | `AuditForge` | Human-readable Relying Party name shown in the passkey prompt. |
| `WEBAUTHN_ORIGIN` | config | `http://localhost:3000` | WebAuthn origin for credential verification. |
| `TRANSCRIPTION_GRPC_URL` | config | `localhost:50051` | gRPC address of the `transcription-py` sidecar. |
| `VLM_GRPC_URL` | config | `localhost:50052` | gRPC address of the `vlm-py` sidecar. |
| `PROBE_RUNNER_GRPC_URL` | config | `localhost:50053` | gRPC address of the `probe-runner-py` sidecar. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | config | — | OpenTelemetry collector endpoint. Leave empty to disable tracing. |
| `OTEL_SERVICE_NAME` | config | `auditforge-api` | Service name tag for OTEL spans. |
| `LOG_LEVEL` | config | `info` | Pino log level: `trace`, `debug`, `info`, `warn`, `error`. |
| `CSP_NONCE_SALT` | **secret** | — | Salt for per-request CSP nonce generation (Next.js middleware). |
| `LLM_ANTHROPIC_API_KEY` | **secret** | — | Anthropic API key. Only used if cloud LLM is opt-in for an engagement. |
| `LLM_OPENAI_API_KEY` | **secret** | — | OpenAI API key. Only used if cloud LLM is opt-in for an engagement. |
| `COST_BUDGET_MONTHLY_USD` | config | `0` | Global monthly LLM cost cap in USD. `0` = unlimited. |
| `MCP_SERVER_PORT` | config | `4001` | Port for the MCP server. |
| `MCP_SIGNING_KEY_ID` | config | — | Key ID used for MCP receipt signing. Defaults to `SIGNING_KEY_ID`. |

---

## Secrets Management

In production, never mount secrets as environment variables from
unprotected ConfigMaps. Use:

- **Kubernetes**: `ExternalSecret` (External Secrets Operator) pulling
  from AWS Secrets Manager, Azure Key Vault, or HashiCorp Vault.
- **Helm**: `existingSecret` values reference pre-created Kubernetes
  Secrets.
- **Local dev**: `.env.local` (gitignored). Copy from `.env.example`.

---

## Related Documents

- [03-installation.md](03-installation.md) — Helm values for secrets.
- [09-secrets-and-key-rotation.md](09-secrets-and-key-rotation.md) —
  key rotation procedures.
