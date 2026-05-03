<!-- SPDX-License-Identifier: BUSL-1.1 -->
# Runbook — `ChainVerifyFailureSpike`

**Severity:** critical (page)
**SLO:** ledger-integrity
**Alert source:** `infra/helm/auditforge/templates/prometheusrule.yaml`

## What this means

The audit ledger's `verifyChain` operation has reported one or more failures in the last 10
minutes. The chain hash links every event to the previous event using a deterministic SHA-256.
A verification failure means the on-disk sequence is no longer consistent with the chain hashes
written when the events were emitted. Causes (in declining order of probability):

1. Storage layer corruption (Postgres page corruption, S3 object truncation).
2. Operator error during a restore (WAL replay stopped early or wrong basebackup picked).
3. Tampering with the audit ledger.

In all three cases, **further writes must stop until the cause is identified.**

## Immediate actions (first 5 minutes)

1. **Acknowledge the page in PagerDuty.** Set the incident summary to
   "Audit ledger chain verification failed".
2. **Freeze writes.** `kubectl scale deploy auditforge-api --replicas=0`. Do not stop the worker
   yet (it must still drain the BullMQ queue for failure forensics).
3. **Page CISO** via PagerDuty escalation. This is mandatory for any chain-verify failure.
4. **Snapshot.** `kubectl exec -it auditforge-postgres-0 -- pg_dump -Fc -f /tmp/ledger-forensic.dump
   auditforge` and `kubectl cp auditforge-postgres-0:/tmp/ledger-forensic.dump
   ./ledger-forensic.dump`. Move the file to a forensic S3 bucket with object-lock enabled.

## Investigate (next 30 minutes)

1. **Run the ledger verify CLI in read-only mode** against the snapshot:
   `node dist/cli.js ledger:verify-chain --snapshot ./ledger-forensic.dump --report
   chain-report.json`. The report identifies the first sequence number where the chain breaks.
2. **Compare against the cold backup** from S3 (last successful basebackup). If the cold backup
   verifies cleanly, the corruption is post-backup; otherwise it predates the most recent backup.
3. **Identify possible storage corruption:** check Postgres logs for `WARNING:  page verification
   failed` and S3 access logs for unusual deletes / truncations.
4. **Identify possible tampering:** correlate `auditforge_rls_bypass_total` and unusual
   admin-portal access in the last 24h. Pull the audit log from the OIDC IdP for the same window.

## Resolution

If the corruption is **storage-side** and the cold backup is clean: run the production restore
runbook (`docs/architecture/disaster-recovery.md` section 4) targeting the WAL segment immediately
before the first failed sequence. The CISO must sign off before re-enabling writes.

If **tampering** is suspected: do **not** restore yet. Engage Security and Legal for evidence
preservation per the incident response policy. Forensic preservation is more important than
recovery.

## Verification

After remediation, `node dist/cli.js ledger:verify-chain --from-genesis` must succeed for every
firm. The `auditforge_ledger_chain_verify_ms` p95 should return to baseline (<200 ms) within
30 minutes of resuming writes.

## Post-incident

A blameless postmortem is required within 5 business days. The postmortem must include:
- Root cause classification (storage / operator / tampering).
- Whether the audit-ledger durability SLO budget was consumed.
- Whether customer-facing notification is required per the MSA.
