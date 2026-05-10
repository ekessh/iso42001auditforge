<!-- SPDX-License-Identifier: BUSL-1.1 -->
# Deploy Production — Runbook

## Topology

- Multi-region active/passive: us-east-1 (primary), us-west-2 (DR)
- EKS multi-AZ in primary; standby DR cluster cold (provisioned, no workloads)
- Postgres Multi-AZ + cross-region read replica for failover
- S3 cross-region replication on evidence/archive buckets
- DNS-based traffic switching via Route53 health checks

## Pre-flight checklist

- [ ] Tag `v*` cut on `main` (signed)
- [ ] Change Advisory Board approval recorded
- [ ] Backup verified within last 24h (`runbooks/db-backup-restore.md`)
- [ ] Staging deployment of same tag green for ≥ 24h
- [ ] On-call paged for the change window
- [ ] War-room link published

## Blue/green deploy

1. Cut a `green` namespace in primary cluster
   ```sh
   kubectl create ns auditforge-green
   kubectl label ns auditforge-green pod-security.kubernetes.io/enforce=restricted
   ```
2. Deploy chart to green
   ```sh
   helm dependency update infra/helm/auditforge
   helm upgrade --install auditforge-green infra/helm/auditforge \
     -f infra/helm/auditforge/values.yaml \
     -f infra/helm/auditforge/values-prod.yaml \
     -n auditforge-green
   ```
3. Run smoke + canary tests against green ingress (private)
   - Health: `/healthz/ready`
   - Audit ledger sign cycle test (synthetic engagement)
   - Probe runner P-AF-CLAUSE-01 regression
4. Switch ALB target group weight 5% → 25% → 100% over 30 min
5. Hold-for-rollback window: 60 min monitoring SLO burn rate
6. On clean window, scale `auditforge-blue` to 0 (kept for fast rollback for 7 days)

## Rollback

- Within 60 min hold window: shift ALB weight back to blue (1 min)
- Beyond: revert image tag in values, `helm upgrade` with prior chart version
- If DB schema regression: restore from PITR (see `db-backup-restore.md`)

## Post-deploy

- Tag chart version in OCI registry
- Update changelog
- Close change ticket with audit ledger receipt ID
