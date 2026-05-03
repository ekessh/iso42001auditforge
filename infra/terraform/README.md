<!-- SPDX-License-Identifier: BUSL-1.1 -->
# AuditForge Terraform

Phase 14 cloud baselines and EKS module for AuditForge.

| Module                          | Purpose                                                                          |
|---------------------------------|----------------------------------------------------------------------------------|
| `modules/aws-baseline`          | VPC, NAT, S3 (versioned + object-lock), KMS, RDS, ElastiCache, ECR, ALB, ACM, Route53 |
| `modules/azure-baseline`        | RG, VNet, Key Vault, Storage, PostgreSQL Flexible Server, Container Registry     |
| `modules/gcp-baseline`          | VPC, Cloud SQL, GCS, Artifact Registry, KMS                                      |
| `modules/auditforge-eks`        | EKS cluster + node groups + addons (ESO, cert-manager, AWS LB controller, CAS)   |
| `environments/dev`              | Example wiring for `dev`                                                         |
| `environments/prod`             | Example wiring for `prod` (Multi-AZ RDS, retention 90d, Object Lock 10y)         |

## Prereqs

```
terraform >= 1.9
aws-cli >= 2.16
azure-cli >= 2.62
gcloud >= 482
```

## State backend

State is stored in S3 with DynamoDB locking. See `environments/*/backend.tf`.

## Quality gates

```
tflint --recursive
tfsec --config-file .tfsec.yml .
checkov -d . --config-file .checkov.yml
```
