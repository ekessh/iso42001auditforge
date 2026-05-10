<!-- SPDX-License-Identifier: BUSL-1.1 -->
# Air-Gap Deployment — Runbook

## When to use

Engagements with auditees who cannot permit any cloud LLM call. CLAUDE.md
mandates that air-gap mode disables cloud at the provider layer; this runbook
covers the cluster-side deployment.

## Pre-bundled artifacts

Air-gap installer ships as a tar bundle:

- All container images (saved with `docker save`, signed with cosign)
- All Helm charts (umbrella + subcharts + Bitnami deps + cert-manager + ESO)
- Ollama model archive (`.gguf` files for default tier-routing models)
- Question library (catalogues snapshot)
- ISO standards / catalogue references

```
auditforge-airgap-v0.14.0.tar.zst  (≈ 25 GB)
├── images/                      Docker tarballs, cosign signatures
├── charts/                      Tarred Helm charts
├── models/ollama/               GGUF model files
├── catalogues/                  ISO 42001 + NIST AI RMF + EU AI Act snapshots
├── verify.sh                    Cosign + sha256 chain verification
└── install.sh                   Orchestrator
```

## Steps

1. Verify bundle on control workstation
   ```sh
   ./verify.sh --pubkey auditforge-release.pub
   ```
2. Push images to private registry
   ```sh
   ./install.sh push-images --registry registry.airgap.local
   ```
3. Provision K8s cluster (RKE2 / k3s / EKS-Anywhere offline)
4. Install dependencies (cert-manager, ESO, kube-prometheus-stack) via vendored charts
5. Deploy AuditForge with air-gap values:
   ```sh
   helm upgrade --install auditforge ./charts/auditforge \
     -f ./charts/auditforge/values.yaml \
     -f ./charts/auditforge/values-airgapped.yaml \
     --set global.airGapMode=true \
     --set global.imageRegistry=registry.airgap.local \
     -n auditforge
   ```
6. Load Ollama models
   ```sh
   kubectl -n auditforge exec sts/auditforge-ollama -- ollama pull /models/llama3.2-3b.gguf
   ```
7. Verify air-gap egress block
   ```sh
   kubectl -n auditforge exec deploy/auditforge-api -- curl -m 5 https://api.anthropic.com
   # MUST fail with connection refused / NetworkPolicy block
   ```

## Catalogue refresh in air-gap

- Catalogues update via signed tar bundle delivered out-of-band
- Bundle contains `catalogues-v{X}.tar.zst` + cosign signature
- Apply via `pnpm --filter @auditforge/catalogues import-bundle`
- Audit-ledger entry: `auditforge.catalogues.import.airgap`

## Validation

- `kubectl -n auditforge get networkpolicy` — every workload has explicit policy
- `kubectl -n auditforge run --rm -it test --image=alpine -- nslookup api.anthropic.com` — must time out
- Provider-layer block: `pnpm --filter @auditforge/llm-provider test:airgap`
