<!--
SPDX-License-Identifier: BUSL-1.1
-->

# Air-Gap Deployment

> This document covers a full offline (air-gapped) AuditForge install:
> no internet access from the production cluster.

---

## Why Air-Gap Mode Exists

ISO 27001 and certain government / defence sector requirements prohibit
outbound internet traffic from systems processing confidential audit
data. AuditForge is designed to run fully offline with local LLM
inference. Cloud LLM is disabled at the provider layer when
`LLM_AIR_GAP_MODE=true`.

See [13-air-gap-vs-cloud-LLM.md](13-air-gap-vs-cloud-LLM.md) for the
trade-off analysis.

---

## Pre-Requisites

- An internal container registry (Harbor, AWS ECR on-prem, etc.).
- An internal Helm chart repository (Chartmuseum or OCI registry).
- GPU nodes reachable within the cluster.
- An internal TSA for RFC 3161 timestamping (or accept the deferral
  policy — see below).

---

## Step 1: Mirror Container Images

On an internet-connected machine, pull all required images and push
to your internal registry:

```bash
# Core services
docker pull ghcr.io/auditforge/api:1.0.0
docker pull ghcr.io/auditforge/web:1.0.0
docker pull ghcr.io/auditforge/worker:1.0.0
docker pull ghcr.io/auditforge/mcp-server:1.0.0

# Python sidecars
docker pull ghcr.io/auditforge/transcription-py:1.0.0
docker pull ghcr.io/auditforge/vlm-py:1.0.0
docker pull ghcr.io/auditforge/probe-runner-py:1.0.0

# Infrastructure
docker pull postgres:16-alpine
docker pull redis:7-alpine
docker pull minio/minio:RELEASE.2024-01-01T00-00-00Z
docker pull getmeili/meilisearch:v1.7.0
docker pull ollama/ollama:latest

# Re-tag and push to internal registry
for img in api web worker mcp-server transcription-py vlm-py probe-runner-py; do
  docker tag ghcr.io/auditforge/${img}:1.0.0 \
             registry.internal.example.com/auditforge/${img}:1.0.0
  docker push registry.internal.example.com/auditforge/${img}:1.0.0
done
```

---

## Step 2: Bundle LLM Models

Ollama models must be pre-bundled into the Ollama image or loaded from
a PVC. The recommended approach is a model-bundle init container:

```bash
# On an internet-connected machine with Ollama installed:
ollama pull llama3.1:8b
ollama pull qwen2.5:32b
ollama pull bge-m3

# Export model blobs (Ollama stores in ~/.ollama/models)
tar -czf ollama-models.tar.gz ~/.ollama/models

# Transfer to air-gapped cluster via approved media
# Then in the cluster:
kubectl create configmap ollama-models-bundle \
  --from-file=ollama-models.tar.gz
```

The Helm chart has an `ollama.modelBundle` value that mounts the bundle
and extracts it at pod startup.

---

## Step 3: Configure the Helm Chart

Add to `my-values.yaml`:

```yaml
global:
  imageRegistry: registry.internal.example.com/auditforge

airGap:
  enabled: true

api:
  env:
    LLM_AIR_GAP_MODE: "true"
    TSA_URL: "https://tsa.internal.example.com/tsr"   # internal TSA

ollama:
  modelBundle:
    enabled: true
    configMapName: ollama-models-bundle
```

---

## Step 4: Internal TSA

For air-gapped deployments, either:

1. **Use an internal TSA**: configure `TSA_URL` to point to an RFC 3161-
   compliant internal service. Several open-source options exist
   (e.g. OpenTSA).

2. **Use the deferred TSA policy**: set `LEDGER_ANCHOR_INTERVAL_MS=0`
   (disables periodic anchoring). TSA tokens are obtained manually when
   the cluster is temporarily connected to an approved external TSA (e.g.
   quarterly archival). The audit ledger stores events with a
   `pending_tsa` status; the verifier accepts this up to the configured
   `TSA_DEFERRAL_HORIZON_HOURS`.

---

## Step 5: Disable Cloud LLM at Network Level

As defense in depth (beyond `LLM_AIR_GAP_MODE=true`), configure a
Kubernetes NetworkPolicy to deny egress to the Anthropic and OpenAI
API endpoints:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-cloud-llm-egress
  namespace: auditforge
spec:
  podSelector: {}
  policyTypes:
    - Egress
  egress:
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
            except:
              - 23.227.38.0/24    # api.anthropic.com (approximate)
              - 104.18.0.0/16     # api.openai.com (approximate)
```

Update the IP blocks to match current authoritative DNS for those
endpoints.

---

## Verifying Air-Gap Mode

```bash
# Should return 200 with airgap: true
curl https://auditforge.internal/healthz/deps | jq '.llm.airGap'

# Attempt to opt-in cloud LLM on an engagement — should be rejected
curl -X PATCH https://auditforge.internal/v1/engagements/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"llmCloudOptIn": true}'
# Expected: 422 Unprocessable Entity — cloud LLM disabled by operator
```

---

## Related Documents

- [../concepts/consent-and-air-gap.md](../concepts/consent-and-air-gap.md)
  — provider guard logic.
- [13-air-gap-vs-cloud-LLM.md](13-air-gap-vs-cloud-LLM.md) — trade-offs.
- [../tutorials/tutorial-04-air-gap-install.md](../tutorials/tutorial-04-air-gap-install.md)
  — narrative walkthrough.
