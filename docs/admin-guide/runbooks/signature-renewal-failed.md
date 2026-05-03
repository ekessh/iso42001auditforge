<!-- SPDX-License-Identifier: BUSL-1.1 -->
# Runbook — `SignatureRenewalFailed` / `MissedArchiveRenewal`

**Severity:** critical (page)
**SLO:** archive-durability, signing-pipeline
**Alert source:** `infra/helm/auditforge/templates/prometheusrule.yaml`

## What this means

The long-term archive's TSA-renewed signatures depend on the daily `archive-renewal` CronJob. The
job iterates over signed audit packages whose RFC 3161 timestamp is within 7 days of expiry and
re-signs them with a fresh timestamp from the TSA. If renewal fails, the archive's evidentiary
weight degrades over time: signatures that expire become unverifiable in court.

Two alert variants:

- `SignatureRenewalFailed` — the CronJob ran and `auditforge_signature_renewal_failure_total`
  incremented.
- `MissedArchiveRenewal` — the CronJob has not completed within 26 hours; the schedule is daily,
  so this means it never started or hung.

## Immediate actions (first 10 minutes)

1. **Acknowledge the page.**
2. **Determine which alert variant fired.** `kubectl get cronjob -l app.kubernetes.io/component=archive-renewal`
   to see the schedule and most recent runs. If `MissedArchiveRenewal`: check whether the CronJob is
   suspended (`spec.suspend: true`) — that is a deliberate maintenance flag that should NEVER be set
   in production.
3. **Inspect the most recent job pod logs** if any: `kubectl logs job/auditforge-archive-renewal-<ts>`.

## Investigate

1. **TSA reachability.** `kubectl run tsa-test --rm -it --restart=Never --image=curlimages/curl --
   curl -sv https://<tsa-endpoint>/`. A non-200 here means the TSA provider has an outage.
2. **Provider rate limit.** Inspect the failure reason label:
   `sum by (reason) (auditforge_signature_renewal_failure_total)`. If `reason="rate_limited"`, slow
   the renewal batch size in `values.yaml` and re-run.
3. **TSA credential expiry.** The TSA client cert is mounted from a Secret. Validate it is not
   expired: `kubectl get secret auditforge-tsa-cert -o jsonpath='{.data.cert\.pem}' | base64 -d
   | openssl x509 -enddate -noout`.
4. **Backlog growth.** `auditforge_signature_renewal_failure_total - auditforge_signature_renewal_success_total`
   approximates the renewal backlog. A backlog above 1000 packages should trigger a manual replay.

## Resolution

1. **Manual run.** `kubectl create job --from=cronjob/auditforge-archive-renewal manual-renewal-$(date +%s)`.
   Watch the metrics; the success counter must increment.
2. **Provider fallover.** If the primary TSA is offline for >2 hours, switch to the secondary TSA
   provider configured in `values.yaml` -> `archiveRenewal.tsa.fallback`. Document the start time.
3. **Renewed packages must be re-verified.** After the run completes, run
   `node dist/cli.js archive:verify --recent=24h`. Every package re-signed in the last 24h must
   verify against both the new and previous timestamps.

## Verification

`auditforge_signature_renewal_success_total` must be incrementing and the failure ratio must be
below the 99.9% signing-pipeline SLO threshold within one renewal cycle.

## Post-incident

If the backlog exceeded 7 days at any point, customers whose archives were affected must be
notified per the MSA's evidentiary-integrity clause.
