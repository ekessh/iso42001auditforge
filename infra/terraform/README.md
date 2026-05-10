<!-- SPDX-License-Identifier: BUSL-1.1 -->
# AuditForge Terraform / OpenTofu

Phase 14 multi-cloud module library + per-environment compositions.

Compatible with Terraform >= 1.6 and OpenTofu >= 1.7.

## Module library (`modules/`)

Naming convention: `{capability}-{cloud}`. The reference deployment is AWS;
other-cloud modules are opt-in stubs that compile and validate but require
implementer extension for production parity.

### Networking

| Module       | Description                                |
|--------------|--------------------------------------------|
| `vpc-aws`    | VPC + subnets + NAT + flow logs            |
| `vpc-azure`  | VNet + subnets (stub)                      |
| `vpc-gcp`    | VPC + subnet (stub)                        |
| `vpc-oci`    | VCN + subnets (stub)                       |

### Managed Kubernetes

| Module             | Description                                          |
|--------------------|------------------------------------------------------|
| `kubernetes-eks`   | EKS cluster + node group + OIDC + KMS-encrypted secrets |
| `kubernetes-aks`   | AKS cluster (stub)                                   |
| `kubernetes-gke`   | GKE cluster (stub)                                   |
| `kubernetes-oke`   | OKE cluster (stub)                                   |

### Postgres

| Module                       | Description                                                        |
|------------------------------|--------------------------------------------------------------------|
| `postgres-rds-pgvector`      | RDS Postgres 16, pgvector + pg_stat_statements, Multi-AZ, KMS      |
| `postgres-flexible-azure`    | Azure PG Flexible Server (stub)                                    |
| `postgres-cloudsql`          | GCP Cloud SQL Postgres (stub)                                      |
| `postgres-oci`               | OCI Postgres placeholder                                           |

### Redis

| Module                   | Description                                                       |
|--------------------------|-------------------------------------------------------------------|
| `redis-elasticache`      | ElastiCache Redis 7 multi-AZ + at-rest/in-transit encryption      |
| `redis-azure-cache`      | Azure Cache for Redis (stub)                                      |
| `redis-gcp-memorystore`  | GCP Memorystore (stub)                                            |
| `redis-oci`              | OCI Redis placeholder                                             |

### Object storage

| Module                | Description                                                                  |
|-----------------------|------------------------------------------------------------------------------|
| `object-storage-s3`   | S3 evidence/archive/reports + KMS + Object Lock COMPLIANCE + lifecycle       |
| `azure-blob`          | Azure Blob storage (stub)                                                    |
| `gcs`                 | GCP GCS retention-locked (stub)                                              |
| `oci-object`          | OCI Object Storage (stub)                                                    |

### Secrets

| Module                | Description                                |
|-----------------------|--------------------------------------------|
| `secrets-aws-sm`      | AWS Secrets Manager wrapper                |
| `azure-keyvault`      | Azure Key Vault wrapper (stub)             |
| `gcp-secret-manager`  | GCP Secret Manager wrapper (stub)          |
| `oci-vault`           | OCI Vault wrapper (stub)                   |

### Signing keys (Ed25519 — wraps `packages/signing` envelopes)

| Module                  | Description                                                              |
|-------------------------|--------------------------------------------------------------------------|
| `signing-key-aws-kms`   | KMS CMK for wrapping Ed25519 envelopes; multi-region; rotation enabled   |
| `azure-keyvault-key`    | Azure KV signing key (EC P-256 placeholder pending Ed25519 GA)           |
| `gcp-kms`               | GCP KMS Ed25519 asymmetric signing key                                   |
| `oci-kms`               | OCI KMS signing key (stub)                                               |

## Environments (`environments/`)

| Env       | Region(s)                | HA                                     | Backup | Object lock | Notes                                  |
|-----------|--------------------------|----------------------------------------|--------|-------------|----------------------------------------|
| `dev`     | us-east-1                | No                                     | 7d     | 1y          | Single-AZ, public ingress              |
| `staging` | us-east-1                | Yes                                    | 14d    | 3y          | Multi-AZ, private ingress              |
| `prod`    | us-east-1 + DR us-west-2 | Yes (Multi-AZ + cross-region replica)  | 90d    | 10y         | GuardDuty, audit log streaming, KMS    |

Each environment has `main.tf`, `variables.tf`, `outputs.tf`, `backend.tf`,
`versions.tf`. State backend: S3 + DynamoDB locking, KMS-encrypted.

## Prereqs

```
terraform >= 1.6  (or opentofu >= 1.7)
aws-cli   >= 2.16
azure-cli >= 2.62  (Azure modules)
gcloud    >= 482   (GCP modules)
oci-cli   >= 3.40  (OCI modules)
```

## Local validation

```sh
pnpm infra:fmt          # terraform fmt -check -recursive
pnpm infra:validate     # terraform validate per env (no AWS creds needed)
pnpm infra:tflint       # tflint static analysis
```

## Plan / Apply (requires cloud creds)

```sh
pnpm infra:plan:dev
pnpm infra:apply:dev
```

## Quality gates

```sh
terraform fmt -check -recursive .
tflint --recursive --chdir=.
checkov -d . --config-file .checkov.yml
```

## SemVer

All modules tagged at the repo level. Module versions follow the chart
appVersion (currently 0.14.0).
