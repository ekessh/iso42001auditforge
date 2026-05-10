<!-- SPDX-License-Identifier: BUSL-1.1 -->
# Deploy Staging — Runbook

## Pre-flight

- AWS account configured with `auditforge-staging` baseline
- Terraform 1.6+ or OpenTofu 1.7+
- Helm 3.14+
- `kubectl` ≥ 1.30
- `awscli` ≥ 2.16
- IAM role: `auditforge-deploy-staging` (assume via SSO)
- Image tags pushed to GHCR (`ghcr.io/auditforge/{api,web,mcp-server,audit-evidence-runner,transcription-py,vlm-py}:<sha>`)

## Steps

1. Provision infrastructure
   ```sh
   cd infra/terraform/environments/staging
   terraform init
   terraform plan -out=tf.plan
   terraform apply tf.plan
   ```
2. Configure kubeconfig
   ```sh
   aws eks update-kubeconfig --region us-east-1 --name auditforge-staging-eks
   kubectl get ns
   ```
3. Install cert-manager and ESO once per cluster
   ```sh
   helm upgrade --install cert-manager jetstack/cert-manager -n cert-manager --create-namespace --set installCRDs=true
   helm upgrade --install external-secrets external-secrets/external-secrets -n external-secrets --create-namespace
   ```
4. Create the `auditforge` namespace with restricted PSS labels
   ```sh
   kubectl create ns auditforge
   kubectl label ns auditforge \
     pod-security.kubernetes.io/enforce=restricted \
     pod-security.kubernetes.io/audit=restricted \
     pod-security.kubernetes.io/warn=restricted
   ```
5. Wire ESO ClusterSecretStore (one-time, Terraform-managed)
6. Deploy chart
   ```sh
   helm dependency update infra/helm/auditforge
   helm upgrade --install auditforge infra/helm/auditforge \
     -f infra/helm/auditforge/values.yaml \
     -f infra/helm/auditforge/values-staging.yaml \
     -n auditforge
   ```
7. Smoke test
   ```sh
   curl -fsS https://api-staging.auditforge.example.com/healthz/ready
   curl -fsS https://app-staging.auditforge.example.com/_next/health
   ```
8. Run migrations
   ```sh
   kubectl -n auditforge exec deploy/auditforge-api -- pnpm db:migrate
   ```

## Rollback

```sh
helm history auditforge -n auditforge
helm rollback auditforge <REVISION> -n auditforge
```

## Verification gates

- All pods Ready within 10 min
- ServiceMonitors discovered by Prometheus (`/api/v1/targets`)
- Synthetic /healthz hit from external prober green
- ZAP DAST baseline scan passes against staging URL
