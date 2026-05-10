<!-- SPDX-License-Identifier: BUSL-1.1 -->
# Postgres Backup, Verify, Restore — Runbook

## Backup architecture

- **Continuous WAL streaming** to S3 via wal-g (sidecar in postgres pod for in-cluster mode; RDS native for managed)
- **Daily base backup** via CronJob `backup-cronjob` at 02:00 UTC
- **Retention:** prod 90d / staging 14d / dev 7d (RDS automated backups + S3 lifecycle)
- **Encryption:** SSE-KMS, KMS key per environment
- **Object Lock COMPLIANCE mode** on `*-archive` bucket (10y in prod)

## Monthly verification drill

Last business day of each month, on-call SRE runs:

```sh
# Restore the latest base backup to a sandbox RDS instance
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier auditforge-prod-pg \
  --target-db-instance-identifier auditforge-restore-drill-$(date +%Y%m) \
  --restore-time $(date -u -d '24 hours ago' --iso-8601=seconds) \
  --db-subnet-group-name auditforge-prod-pg \
  --no-multi-az

# Run integrity script (verifies receipt chain + audit ledger hashes)
pnpm --filter @auditforge/db verify:restore --target $RESTORED_HOST

# Tear down
aws rds delete-db-instance --db-instance-identifier auditforge-restore-drill-$(date +%Y%m) \
  --skip-final-snapshot --delete-automated-backups
```

Record drill outcome in `compliance/backup-verification-log.md`.

## PITR procedure

**RTO:** 30 minutes
**RPO:** 5 minutes (WAL streaming) — 24 hours (base only fallback)

```sh
# Identify last good timestamp BEFORE the bad event
TARGET="2026-05-09T14:23:00Z"

# Restore to a NEW instance (do NOT clobber prod)
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier auditforge-prod-pg \
  --target-db-instance-identifier auditforge-prod-pg-restored \
  --restore-time "$TARGET" \
  --db-subnet-group-name auditforge-prod-pg

# After verification, swap DNS / connection string
# (rename original to *-quarantine, restored to canonical name)
```

## Data integrity rules

- NEVER `DROP DATABASE` on prod
- `audit_ledger_*` tables append-only — restore in place would break chain
  signatures. Always restore to NEW instance and reconcile.
- After any restore, validate chain via `pnpm --filter @auditforge/signing verify-chain`
