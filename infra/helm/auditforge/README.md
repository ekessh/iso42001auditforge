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

## Subcharts (`charts/`)

The umbrella chart composes four service subcharts plus optional Bitnami
managed-data subcharts:

| Subchart                  | Purpose                                                  |
|---------------------------|----------------------------------------------------------|
| `mcp-server`              | AuditForge MCP server (Phase 15+)                        |
| `audit-evidence-runner`   | Probe sandbox (garak / PyRIT / HarmBench wrappers)       |
| `transcription-py`        | WhisperX + Pyannote 3.1 service                          |
| `vlm-py`                  | Qwen2.5-VL / DeepSeek-OCR vision-language extraction     |

Optional Bitnami dependencies — pinned in `Chart.yaml`:

| Dependency                | Version    | Use as alt to in-cluster StatefulSet |
|---------------------------|------------|--------------------------------------|
| `postgresql` (Bitnami)    | 15.5.20    | postgres                             |
| `redis` (Bitnami)         | 20.1.7     | redis                                |
| `minio` (Bitnami)         | 14.7.13    | objectStorage                        |

These are gated by their `*.enabled` toggles in values.yaml. Pinning is by
reproducible-deploy policy. To upgrade, bump version + run `helm dependency
update` and validate via the `infra-validate` workflow.

## Air-gap mode

Set `global.airGapMode=true`. This:

1. Tightens NetworkPolicies in every subchart (egress allows only DNS +
   intra-namespace AuditForge traffic — no internet).
2. Surfaces an `AUDITFORGE_AIRGAP=true` env var so the LLM provider layer
   blocks all cloud routes.

For full air-gap deployment see `infra/runbooks/air-gap-deployment.md`.
