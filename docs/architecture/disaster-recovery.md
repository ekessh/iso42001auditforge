<!-- SPDX-License-Identifier: BUSL-1.1 -->
# AuditForge ISO 42001 — Disaster Recovery

This document defines the recovery point objective (RPO), recovery time objective (RTO), the
backup and replication topology, and the quarterly restore-drill runbook.

## 1. Targets

| Class | RPO | RTO |
|-------|-----|-----|
| Postgres (audit ledger, working papers, findings) | <= 15 minutes via continuous WAL archiving | 4 hours |
| Object storage (S3 evidence, archive, reports) | 0 (cross-region replication enabled) | 1 hour |
| Redis (queue state) | 0 — work is replayable from Postgres | 30 minutes |
| Telemetry stores (Prom, Tempo, Loki) | 24 hours (best-effort) | 24 hours |

A 15m RPO is two orders of magnitude better than the daily basebackup the chart originally
shipped with, and is the only RPO consistent with the 99.999% audit-ledger durability SLO.

## 2. Mandatory addition: continuous WAL archiving

The chart's daily `pg_basebackup` CronJob remains for full-image restores, but it is not
sufficient on its own. Operators MUST enable continuous WAL archiving alongside it.

### Required Postgres parameters (set via `values.yaml` -> `postgres.parameters`):

```yaml
postgres:
  parameters:
    archive_mode: "on"
    archive_command: "test ! -f /var/lib/postgresql/walarchive/%f && cp %p /var/lib/postgresql/walarchive/%f && /usr/local/bin/wal-upload.sh %f"
    archive_timeout: "60"     # at least every 60s
    wal_level: replica
    max_wal_senders: "10"
    max_replication_slots: "10"
```

### Required topology

- A `pgBackRest` (preferred) or `wal-g` sidecar continuously ships WAL segments to the same S3
  bucket as the basebackup, keyed by `auditforge/wal/<timestamp>`.
- The bucket has versioning + object lock enabled with a retention of 30d minimum (matching the
  basebackup retention).
- Cross-region replication is configured on the bucket so a regional outage does not lose data.
- A `BackupTooOld` PrometheusRule alerts when the most recent basebackup is older than 25h, and a
  paired `WalShipLag` alert (paged) fires if the most recent WAL segment in S3 is older than 5m.

### `auditforge_backup_age_seconds`

The basebackup CronJob writes `auditforge_backup_age_seconds` to the metrics gateway at the end of
every run. The gauge is the signal `BackupTooOld` evaluates. The WAL shipper writes a similar
`auditforge_wal_lag_seconds` gauge keyed off the most recent uploaded segment.

## 3. Restore

### 3.1 Restore drill — quarterly

A quarterly restore drill is a P1 obligation. The drill is run end-to-end from cold backup, with
the resulting cluster validated by replaying the audit ledger's `verifyChain` from genesis. The
drill timing is captured in this document below.

### 3.2 Procedure

1. **Spin up an isolated namespace.** `kubectl create ns auditforge-dr-drill`. Apply the chart with
   `restore.enabled=true` and `restore.basebackup=s3://auditforge-backups/<timestamp>` plus
   `restore.walPrefix=s3://auditforge-backups/wal/<timestamp>/`.
2. **Postgres recovery.** The init container fetches the basebackup and executes `pg_basebackup`
   restore, then enters recovery with `restore_command` pointing at the WAL shipper. Recovery target
   is the latest available WAL segment (`recovery_target=immediate, recovery_target_action=promote`).
3. **Replay verification.** Once Postgres is up, run `kubectl exec ... -- node dist/cli.js
   ledger:verify-chain --from-genesis`. The CLI walks the ledger and emits
   `auditforge_ledger_chain_verify_ms` and any `auditforge_ledger_emit_failures_total{reason="chain_verify"}`
   counters. A successful drill reports `chain_ok=true` for every firm.
4. **Object storage parity.** Run `node dist/cli.js storage:reconcile` to compare object keys
   referenced by the working-paper rows against the bucket inventory. Fail the drill if any
   reference is dangling.
5. **Decommission.** `kubectl delete ns auditforge-dr-drill`.

### 3.3 Timing log

| Date | RPO observed | RTO observed | Verifier | Notes |
|------|--------------|--------------|----------|-------|
| _pending first drill_ | — | — | — | Schedule the first drill within 30 days of the next minor release. |

## 4. Production restore (real disaster)

The production runbook is identical to the drill in steps 1-3, but is executed in the production
namespace under change-freeze. Two operators must be present (one read-only attestor). The CISO
must be paged before step 1.

The CISO sign-off is required because a restore from cold backup necessarily involves replaying
the audit ledger, which materially changes the chain hash front. Customers must be informed
within 24 hours per the data-incident clause of the master service agreement.

## 5. Risks not covered by this RPO/RTO

- **Logical corruption.** A bad migration or rogue `DELETE` is replicated by WAL just like normal
  writes. The basebackup retention of 30 days bounds the recovery window. For longer-term
  forensic recovery, the ledger's hash-chain provides tamper evidence; combined with the
  TSA-renewed signatures (see `signature-renewal-failed.md`), it is possible to identify the WAL
  segment at which corruption began and restore to that point.
- **Multi-region outage.** S3 cross-region replication is asynchronous; under an active-region
  failure the secondary may lag by up to 15 minutes. Stated RPO accounts for this.
- **TSA provider outage.** Signature renewal can fall behind by up to 7 days before the audit
  archive enters a "renewal-pending" state. Sustained outages require switching providers via the
  multi-provider routing in the signing pipeline.

## 6. Owner

Platform SRE (lead). Audit Engine team (verifyChain replay). CISO (sign-off on production restore).
