<!-- SPDX-License-Identifier: BUSL-1.1 -->
# Disaster Recovery — Runbook

## Targets

| Metric | Prod | Staging |
| ------ | ---- | ------- |
| RTO    | 1 hour | 4 hours |
| RPO    | 5 minutes | 1 hour |

## Architecture

- Primary: us-east-1
- DR: us-west-2 (cold standby — Terraform provisioned, scaled to 0)
- Postgres: cross-region read replica with promotion automation
- S3: CRR on `*-evidence` and `*-archive`
- DNS: Route53 health-checked failover

## Failover drill (game day)

Run quarterly. Schedule with full eng leadership.

```sh
# 1. Trigger failover
cd infra/terraform/environments/prod-dr
terraform apply -target=module.eks.aws_eks_node_group.this -var "node_desired_size=6"

# 2. Promote Postgres read replica
aws rds promote-read-replica --db-instance-identifier auditforge-prod-pg-dr

# 3. Update kubeconfig
aws eks update-kubeconfig --region us-west-2 --name auditforge-prod-dr-eks

# 4. Switch ESO secret stores to DR Secrets Manager
kubectl -n auditforge patch clustersecretstore aws-secrets-manager \
  --type=merge -p '{"spec":{"provider":{"aws":{"region":"us-west-2"}}}}'

# 5. Helm upgrade with DR overrides
helm upgrade auditforge infra/helm/auditforge \
  -f infra/helm/auditforge/values-prod.yaml \
  -f infra/helm/auditforge/values-prod-dr.yaml \
  -n auditforge

# 6. Update Route53 to point at DR ALB
aws route53 change-resource-record-sets --hosted-zone-id $ZONE \
  --change-batch file://dr-failover.json
```

## Validation after failover

- Synthetic /healthz from external prober green within 5 min
- 5 representative engagement reads succeed
- Receipt chain verifies for last 100 receipts
- WebAuthn login flow works
- Worker queue draining

## Failback

- Re-replicate Postgres us-west-2 → us-east-1 (read replica relationship reversed)
- Wait until replica lag < 30s
- Reverse Route53 cutover
- Scale us-west-2 back to standby

## Chaos drills

Monthly:

- Kill random API pod — validate HPA + PDB
- Inject 200ms network latency on Postgres path
- Simulate AZ failure (cordon all nodes in one AZ)

Document outcomes in `compliance/dr-drill-log.md`.
