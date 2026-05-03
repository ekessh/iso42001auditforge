<!-- SPDX-License-Identifier: BUSL-1.1 -->
# Runbook — `AVScanDisabled`

**Severity:** critical (page)
**SLO:** evidence-integrity
**Alert source:** `infra/helm/auditforge/templates/prometheusrule.yaml`

## What this means

The antivirus scanner that runs over uploaded evidence has stopped reporting its heartbeat
(`auditforge_av_scan_enabled` < 1 for 5 minutes). New evidence uploads cannot be confirmed safe
to surface to auditors, and the chain of custody for every upload accepted while the scanner was
down is suspect.

## Immediate actions (first 5 minutes)

1. **Acknowledge the page.**
2. **Quarantine new uploads.** `kubectl scale deploy auditforge-evidence-uploader --replicas=0` (the
   web UI surfaces a banner because the readiness check observes the same gauge). Existing
   evidence remains downloadable.
3. **Snapshot the AV worker pod state.** `kubectl describe pod -l app.kubernetes.io/component=av-scanner`
   and `kubectl logs -l app.kubernetes.io/component=av-scanner --tail=500`.

## Investigate

1. **Process health.** A common cause is the AV signatures DB update process holding a write lock
   that exceeded the heartbeat timeout. Check `kubectl exec` into the pod and confirm freshclam
   (or equivalent) is not stuck.
2. **Integration health.** If the scanner runs as a sidecar to the worker, check the Unix socket
   between the worker and the scanner. `kubectl exec -- ls -la /run/clamd/`.
3. **Network policy / egress.** If the scanner needs to fetch signatures from the internet, confirm
   the egress policy still allows the upstream signature CDN (and that the CDN itself is reachable).

## Resolution

1. **Restart the scanner.** `kubectl rollout restart deploy/auditforge-av-scanner` and wait for the
   `auditforge_av_scan_enabled` gauge to return to 1. The alert clears within 5 minutes once the
   gauge holds at 1.
2. **Re-scan everything received during the outage.** Run
   `node dist/cli.js evidence:rescan --since=<outage-start-iso>`. The CLI emits
   `auditforge_ledger_emit_total{event_type="evidence.rescan_completed"}` per item; verify the
   total matches the count of uploads accepted during the window.
3. **Resume uploads.** `kubectl scale deploy auditforge-evidence-uploader --replicas=2`.

## Verification

`auditforge_av_scan_enabled == 1` for 30 consecutive minutes. The post-outage rescan job has
emitted a final `evidence.rescan_completed` event covering every upload that landed during the
outage.

## Post-incident

Every upload received during the outage must be flagged in the working-paper system as
"AV-rescanned-after-outage" with a link to the evidence.rescan_completed ledger event.
