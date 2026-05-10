<!--
SPDX-License-Identifier: BUSL-1.1
-->

# Prerequisites

> Supported clouds, Kubernetes versions, and infrastructure component
> version requirements before installing AuditForge.

---

## Supported Deployment Targets

| Target | Status |
|---|---|
| AWS (EKS) | Supported (primary CI target) |
| Azure (AKS) | Supported |
| Google Cloud (GKE) | Supported |
| OCI (OKE) | Supported (community tested) |
| On-premises Kubernetes (k3s, RKE2, vanilla) | Supported |
| Docker Compose (single node) | Supported for dev and small deployments |
| Air-gapped Kubernetes | Supported — see [05-air-gap-deployment.md](05-air-gap-deployment.md) |

---

## Kubernetes

- **Version**: 1.28 or later.
- **Required features**: PersistentVolumes, StorageClass, HorizontalPodAutoscaler,
  NetworkPolicy, ServiceAccount token projection.
- **Ingress**: any NGINX Ingress Controller or AWS ALB Ingress Controller.
  TLS termination at ingress is required for production.

---

## Postgres

- **Version**: 16.x (required for pgvector 0.7+ and pg_partman 5.x).
- **Extensions**: `pgvector`, `pg_trgm`, `pg_partman`, `uuid-ossp`.
- **RLS**: must be enabled (default in standard Postgres installs).
- **Managed options**: AWS RDS for PostgreSQL 16, Azure Database for
  PostgreSQL Flexible Server 16, Cloud SQL for PostgreSQL 16, Supabase
  (with pgvector enabled).

---

## Redis

- **Version**: 7.2 or later.
- **Persistence**: RDB + AOF recommended (BullMQ queues must survive
  pod restarts).
- **Managed options**: ElastiCache (Valkey/Redis 7), Azure Cache for
  Redis, Memorystore.

---

## Object Storage

- **MinIO**: RELEASE.2024-01-01 or later. Deployed via the MinIO Operator
  Helm chart, or a standalone StatefulSet for small installs.
- **S3-compatible**: any S3-compatible endpoint works (AWS S3, Azure Blob
  with S3 adapter, GCS with S3 adapter, Wasabi, Backblaze B2).
- **Required**: versioning enabled; server-side encryption enabled.

---

## Meilisearch

- **Version**: 1.7 or later.
- **Persistence**: PVC required. Meilisearch data directory must survive
  pod restarts.

---

## Ollama (Local LLM — default)

- **Version**: 0.3 or later.
- **GPU**: NVIDIA GPU with CUDA 12+ recommended for models ≥ 8B. CPU
  inference is supported but slow.
- **Models required** (pre-pull before deploy):
  - `llama3.1:8b` (small tier)
  - `qwen2.5:32b` (medium tier — requires ≥ 48 GB VRAM across GPUs)
  - `bge-m3` (embedding)
- **Alternative**: vLLM 0.5+ for production multi-GPU serving.

---

## Python Sidecars

| Sidecar | Python version | GPU required |
|---|---|---|
| `transcription-py` (WhisperX + Pyannote) | 3.11 | Yes (CUDA 12+) for real-time |
| `vlm-py` (Qwen2.5-VL / DeepSeek-OCR) | 3.11 | Yes (CUDA 12+) |
| `probe-runner-py` | 3.11 | Recommended |
| `audit-evidence-runner` | 3.11 | No |

---

## TLS and Certificate Management

- A wildcard or multi-SAN TLS certificate is required for the ingress.
- cert-manager (1.14+) with Let's Encrypt or a private CA is supported.
- For air-gapped deployments, a private CA is required.

---

## Related Documents

- [03-installation.md](03-installation.md) — Helm install steps.
- [05-air-gap-deployment.md](05-air-gap-deployment.md) — air-gap guide.
