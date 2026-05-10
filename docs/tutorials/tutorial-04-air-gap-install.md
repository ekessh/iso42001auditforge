<!--
SPDX-License-Identifier: BUSL-1.1
-->

# Tutorial 04: Air-Gap Install

> Narrative walkthrough of bringing up the full AuditForge stack
> offline, with no internet access from the target server.

---

## Scenario

You are deploying AuditForge for a government agency whose data centre
has no outbound internet access. All images and model weights must be
transferred via approved physical media.

---

## Phase 1: Prepare on an Internet-Connected Machine

### Pull container images

```bash
# Core AuditForge images
docker pull ghcr.io/auditforge/api:1.0.0
docker pull ghcr.io/auditforge/web:1.0.0
docker pull ghcr.io/auditforge/worker:1.0.0
docker pull ghcr.io/auditforge/mcp-server:1.0.0
docker pull ghcr.io/auditforge/transcription-py:1.0.0
docker pull ghcr.io/auditforge/vlm-py:1.0.0
docker pull ghcr.io/auditforge/probe-runner-py:1.0.0

# Infrastructure
docker pull postgres:16-alpine
docker pull redis:7-alpine
docker pull minio/minio:RELEASE.2024-01-01T00-00-00Z
docker pull getmeili/meilisearch:v1.7.0
docker pull ollama/ollama:latest

# Save to tar archive
docker save ghcr.io/auditforge/api:1.0.0 \
           ghcr.io/auditforge/web:1.0.0 \
           ... \
  | gzip > auditforge-images.tar.gz
```

### Pull LLM models

```bash
ollama pull llama3.1:8b
ollama pull qwen2.5:32b
ollama pull bge-m3

tar -czf ollama-models.tar.gz ~/.ollama/models
```

### Download the Helm chart

```bash
helm pull auditforge/auditforge --version 1.0.0
# Output: auditforge-1.0.0.tgz
```

### Package everything on approved media

```
USB drive or DVD:
├── auditforge-images.tar.gz
├── ollama-models.tar.gz
├── auditforge-1.0.0.tgz
└── my-values-airgap.yaml
```

---

## Phase 2: Load on the Air-Gapped Server

```bash
# Load container images
docker load < auditforge-images.tar.gz

# If using a local registry:
docker tag ghcr.io/auditforge/api:1.0.0 \
           registry.internal.gov/auditforge/api:1.0.0
docker push registry.internal.gov/auditforge/api:1.0.0
# (repeat for all images)

# Load Ollama models
mkdir -p ~/.ollama/models
tar -xzf ollama-models.tar.gz -C ~/
```

---

## Phase 3: Configure `my-values-airgap.yaml`

```yaml
global:
  imageRegistry: registry.internal.gov/auditforge
  domain: auditforge.internal.gov

airGap:
  enabled: true

api:
  env:
    LLM_AIR_GAP_MODE: "true"
    TSA_URL: "https://tsa.internal.gov/tsr"

ollama:
  modelBundle:
    enabled: false  # models already loaded in ~/.ollama
```

---

## Phase 4: Install

```bash
helm install auditforge ./auditforge-1.0.0.tgz \
  --namespace auditforge \
  --create-namespace \
  --values my-values-airgap.yaml

# Wait for pods
kubectl rollout status deployment/auditforge-api -n auditforge

# Run migrations
kubectl exec -n auditforge deploy/auditforge-api -- pnpm db:migrate
kubectl exec -n auditforge deploy/auditforge-api -- pnpm db:seed
```

---

## Phase 5: Verify Air-Gap Mode

```bash
# Air-gap flag should be true
curl https://auditforge.internal.gov/healthz/deps \
  | jq '.llm.airGap'
# Expected: true

# Chain verify (empty on fresh install)
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://auditforge.internal.gov/v1/admin/chain/verify-all
```

---

## Related Documents

- [../operator-guide/05-air-gap-deployment.md](../operator-guide/05-air-gap-deployment.md)
  — full operator reference.
- [../operator-guide/13-air-gap-vs-cloud-LLM.md](../operator-guide/13-air-gap-vs-cloud-LLM.md)
  — trade-off analysis.
