<!--
SPDX-License-Identifier: BUSL-1.1
-->

# Backup and Restore

> Backup procedures for Postgres, MinIO, signing keys, and the audit
> ledger. Cross-reference: `infra/runbooks/db-backup-restore.md`.

---

## What Must Be Backed Up

| Component | Criticality | Loss impact |
|---|---|---|
| Postgres database | Critical | All engagement data, claim graph, ledger events |
| MinIO evidence vault | Critical | Evidence files; chain-of-custody broken without originals |
| Ed25519 signing private key | Critical | Cannot verify or extend existing signed ledger without rotation |
| Meilisearch index | Low | Rebuilt from Postgres on restore; 10–30 min for large deployments |
| Redis queues | Low | In-flight jobs are re-queued on next pod start; at-most-once delivery |

---

## Postgres Backup

Refer to `infra/runbooks/db-backup-restore.md` for the detailed
procedure. Summary:

- **Continuous WAL archiving** to S3 (via pgBackRest or Barman).
- **Daily base backup** via `pg_basebackup` or pgBackRest full backup.
- **Retention**: 30-day rolling window minimum; regulatory retention for
  audit data is typically 3–7 years — archive the corresponding backup
  sets accordingly.
- **Test restores**: run a restore drill monthly in a staging cluster.
  Validate with `pnpm db:migrate --dry-run` and a chain verification
  check.

RLS is schema-level; it survives a full Postgres dump and restore without
change. However, the Postgres superuser used for `pg_dump` bypasses RLS —
store the dump securely.

---

## MinIO Evidence Vault Backup

- Enable **MinIO versioning** on the evidence bucket.
- Configure **MinIO replication** to a secondary MinIO instance or an
  S3-compatible remote.
- For regulatory archival: enable **S3 Object Lock** (WORM) on the
  bucket with a retention period matching the regulatory requirement.

---

## Signing Key Backup

The Ed25519 signing private key is the most sensitive backup item.

For `SoftwareSigningProvider` (dev/small deployments):

- Key is stored as a Kubernetes Secret (`auditforge-signing-secret`).
- Back up using `kubectl get secret auditforge-signing-secret -o yaml`
  and store the output in your secrets manager (not in Git).

For HSM/KMS (production):

- The key never leaves the HSM. Back up the HSM per the vendor's
  high-availability guide.
- Store the key ID and the firm's public key separately (public key is
  not secret and is included in every issued report).

**Key rotation**: if the signing key is compromised, see
[09-secrets-and-key-rotation.md](09-secrets-and-key-rotation.md).

---

## Restore Procedure

### Full disaster recovery (Postgres + MinIO)

1. Restore Postgres from the latest base backup + WAL replay to the
   target point in time. Follow `infra/runbooks/db-backup-restore.md`.
2. Restore MinIO from the replicated bucket or snapshot.
3. Deploy AuditForge via Helm (same chart version as the backup).
4. Run `pnpm db:migrate` to apply any migrations that occurred after
   the backup.
5. Run chain verification: `POST /v1/admin/chain/verify-all`. Expect
   zero errors for events before the restore point.
6. Rebuild Meilisearch index: `pnpm search:reindex` (or trigger via
   admin API).

### Partial restore (single engagement)

If a single engagement's data is corrupted but the ledger is intact:

1. Use the ledger replay admin command:
   ```bash
   kubectl exec -n auditforge deploy/auditforge-api -- \
     pnpm ledger:replay --engagement-id <id> --to-seq <seq>
   ```
   This rebuilds the projection tables for that engagement from ledger
   events up to sequence `<seq>`.
2. Verify the coverage matrix and finding counts match the expected
   state.

---

## Related Documents

- `infra/runbooks/db-backup-restore.md` — detailed Postgres runbook.
- [09-secrets-and-key-rotation.md](09-secrets-and-key-rotation.md) —
  signing key rotation.
- [../concepts/audit-ledger.md](../concepts/audit-ledger.md) — ledger
  replay semantics.
