<!--
SPDX-License-Identifier: BUSL-1.1
-->

# Incidents and Rollback

> This document tells the auditor what to do when something goes wrong
> mid-engagement: data appears incorrect, a probe run corrupts state,
> or the system returns unexpected errors.

---

## First Steps for Any Anomaly

1. **Stop the affected workflow** — do not continue the interview,
   evidence upload, or probe run until the anomaly is understood.
2. **Take a screenshot or export the relevant view** for your records.
3. **Note the ledger sequence number** shown at the bottom of every
   engagement page — this is the high-water mark for investigation.
4. **Contact your firm's operator** with the engagement ID and the ledger
   sequence number.

---

## Common Anomalies and Resolutions

### Coverage score appears incorrect

1. Navigate to **Coverage → Recalculate**. The coverage module replays
   all confirmed claims and recomputes the matrix.
2. If the score changes, the prior display was a caching artifact. The
   ledger is the source of truth.
3. If the score still appears wrong, export the coverage history
   (`GET /v1/engagements/{engagementId}/coverage`) and share with the
   operator.

### Claim attributed to wrong clause

1. Open the claim in the working paper or evidence drawer.
2. Click **Edit Attribution**.
3. Remove the incorrect clause link and add the correct one.
4. The system emits `attribution.corrected` to the ledger; both the
   old and new attribution are preserved.

### Candidate finding appeared without engine action

This should not happen — candidate findings require either a probe
`fail` result or the NC drafter to have run. If an unexpected candidate
finding appears:

1. Open the finding and check the **Provenance** tab — it shows which
   engine action created it and the model/prompt version.
2. If the provenance is missing or invalid, do not promote or dismiss
   the finding. Contact the operator immediately with the finding ID.

### Working paper content lost after offline sync

1. Open the working paper history (`WP → History`). Every edit is
   stored as a Yjs op.
2. Click **Restore from History** to pick a prior checkpoint.
3. The restore emits `working_paper.restored` to the ledger.

### Report signing fails (TSA unavailable)

The system retries the TSA call automatically for 5 minutes with
exponential backoff. If the TSA remains unavailable:

1. The report is saved with a `pending_tsa` status.
2. The worker retries every 30 seconds until the TSA responds
   (up to the `TSA_TIMEOUT_HOURS` operator configuration value).
3. The report is not issued until the TSA token is obtained.
4. If the TSA is down for an extended period, the operator can switch
   to a backup TSA provider (see
   [../operator-guide/09-secrets-and-key-rotation.md](../operator-guide/09-secrets-and-key-rotation.md)).

---

## Rollback Semantics

The audit ledger is **append-only**. AuditForge does not delete ledger
events. Rollback means:

1. Creating **correcting events** that invalidate prior state.
2. The prior state remains visible in the ledger history.

If a serious error requires reverting an engagement to a prior state
(e.g. a probe run corrupted the coverage matrix), the operator can
run the `ledger:replay` admin command, which rebuilds the projection
tables from the ledger up to a specified sequence number. This does not
delete events; it rebuilds the read model.

---

## Escalation Path

| Severity | Action |
|---|---|
| Data display anomaly | Try recalculate; if persists, open a support ticket. |
| Unexpected finding or claim | Do not act on it; contact operator immediately. |
| Evidence file hash mismatch | Stop the engagement; contact operator; preserve all screenshots. |
| Report signature failure | Wait for TSA retry; if > 2 hours, escalate to operator. |
| Ledger chain verification failure | Stop all work; escalate to operator with full chain dump. |

---

## Related Documents

- [../operator-guide/11-incident-response.md](../operator-guide/11-incident-response.md)
  — operator-side incident response.
- [../concepts/audit-ledger.md](../concepts/audit-ledger.md) — ledger
  replay explained.
