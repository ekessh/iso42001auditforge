<!-- SPDX-License-Identifier: BUSL-1.1 -->
# AuditForge Helm Chart

Phase 14 hardened Helm chart for the AuditForge ISO/IEC 42001 Lead Auditor Workbench.

## Features

- API + Worker + Web Deployments, each with HPA, PDB, NetworkPolicy, ServiceAccount + Role/RoleBinding
- StatefulSets for PostgreSQL, Redis, MinIO, Meilisearch (toggle to external/RDS/ElastiCache/S3)
- Optional Ollama StatefulSet for local LLM inference (`ollama.enabled=true`)
- ExternalSecret integration (External Secrets Operator) — falls back to Sealed Secrets when disabled
- TLS-everywhere via cert-manager-issued certificates
- Default-deny NetworkPolicy plus per-component allowlists
- Strict podSecurityContext: `runAsNonRoot`, `runAsUser=10001`, read-only rootfs, dropped capabilities, RuntimeDefault seccomp
- BackupCronJob (daily `pg_basebackup` to S3) and ArchiveRenewal CronJob (signature renewal for long-term audit archive)
- ServiceMonitor for Prometheus + ready-to-fire PrometheusRule (SLO burn-rate alerts, ledger integrity, RLS bypass detection, AV scan disabled)
- `helm test` smoke job hits API `/healthz/live`

## Layouts

| Values file              | Use                                                  |
|--------------------------|------------------------------------------------------|
| `values.yaml`            | Defaults — single-replica + in-cluster data services |
| `values-prod.yaml`       | Production HA — RDS / ElastiCache / S3 / ESO         |
| `values-airgapped.yaml`  | Air-gapped — private registry, no cloud connectors   |

## Quick start

```sh
helm lint infra/helm/auditforge
helm template release infra/helm/auditforge -n auditforge --create-namespace > /tmp/rendered.yaml
helm install release infra/helm/auditforge -n auditforge --create-namespace
helm test release -n auditforge
```

## Required external dependencies

- ingress-nginx (or compatible IngressClass)
- cert-manager
- prometheus-operator (CRDs: `ServiceMonitor`, `PrometheusRule`)
- external-secrets-operator (only when `externalSecrets.enabled=true`)
