<!-- SPDX-License-Identifier: BUSL-1.1 -->
# Secret Rotation — Runbook

## Inventory

| Secret                       | Cadence  | Method                     |
| ---------------------------- | -------- | -------------------------- |
| Ed25519 audit signing key    | 12 months | Dual-key window            |
| Postgres master password     | 90 days  | RDS automated rotation     |
| Redis AUTH token             | 180 days | ElastiCache rotation       |
| MinIO/S3 access keys         | 90 days  | IAM key rotation           |
| Meilisearch master key       | 180 days | Manual via ESO             |
| WebAuthn relying-party key   | 36 months | Manual                     |
| OAuth client secrets         | 12 months | Manual                     |
| TLS certs (Let's Encrypt)    | 60 days  | cert-manager auto          |

## Ed25519 signing key rotation (zero-downtime)

The audit ledger MUST keep verifying historical receipts after key rotation. We
use a dual-key window:

1. T=0: Provision new keypair `signing-v{N+1}` in KMS-wrapped envelope
2. Add `signing-v{N+1}` to `packages/signing` provider as `verification-only`
3. Wait `propagation_window` (default 24h — covers all replicas + cron jobs)
4. T=24h: Promote v{N+1} to `active-signing`; v{N} demoted to `verification-only`
5. Wait `archive_window` (90d) — receipts older than this are stable in archive
6. T=24h+90d: Optional — retire v{N} from active provider list (still in archive)

Audit-ledger entry per stage: `auditforge.signing.key.rotate.{stage}`.

```sh
# Generate next key
pnpm --filter @auditforge/signing keys:generate --version $(($CURRENT_VERSION+1))

# Wrap with KMS and store in Secrets Manager via ESO
aws secretsmanager update-secret \
  --secret-id auditforge/signing/v$NEXT \
  --secret-binary fileb://wrapped.bin

# Trigger config reload (rolling restart of api + worker)
kubectl -n auditforge rollout restart deploy/auditforge-api deploy/auditforge-worker
```

## Postgres password rotation

```sh
# RDS automatically rotates and updates Secrets Manager
aws secretsmanager rotate-secret --secret-id auditforge-prod-pg-master

# ESO refreshes within refreshInterval (default 1h)
# Force-refresh:
kubectl -n auditforge annotate externalsecret auditforge-postgres force-sync=$(date +%s) --overwrite
```

## API tokens

API tokens for engagement-scope LLM provider keys (cloud LLM opt-in):

- Each engagement has its own provider keys
- Consent-registry tracks key fingerprint, not raw key
- Rotation requires auditee written re-consent
- See `packages/consent-registry` for the workflow
