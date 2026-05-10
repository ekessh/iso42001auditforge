<!--
SPDX-License-Identifier: BUSL-1.1
-->

# Installation

> Step-by-step Helm installation of AuditForge on Kubernetes.

---

## Quick Install (Internet-Connected)

```bash
helm repo add auditforge https://charts.auditforge.io
helm repo update

helm install auditforge auditforge/auditforge \
  --namespace auditforge \
  --create-namespace \
  --values my-values.yaml
```

The Helm chart is in `infra/helm/`. The chart deploys all components
defined in the architecture overview.

---

## Preparing `my-values.yaml`

The chart ships a `values.yaml` with all defaults. Override only what
you need. Minimum required overrides for a production install:

```yaml
global:
  domain: auditforge.example.com
  imageRegistry: ""          # leave empty for Docker Hub; set for air-gap

postgres:
  host: my-postgres.example.com
  port: 5432
  database: auditforge
  existingSecret: auditforge-postgres-secret   # key: password

redis:
  host: my-redis.example.com
  existingSecret: auditforge-redis-secret      # key: password

minio:
  endpoint: https://minio.example.com
  bucket: auditforge-evidence
  existingSecret: auditforge-minio-secret      # keys: accessKey, secretKey

meilisearch:
  host: http://meilisearch:7700
  existingSecret: auditforge-meili-secret      # key: masterKey

signing:
  existingSecret: auditforge-signing-secret    # key: ed25519PrivateKey (hex)
  tsaUrl: https://freetsa.org/tsr              # or your chosen TSA

ollama:
  enabled: true
  models:
    - llama3.1:8b
    - qwen2.5:32b
    - bge-m3

ingress:
  enabled: true
  className: nginx
  tls:
    - secretName: auditforge-tls
      hosts:
        - auditforge.example.com
```

For the full env-var reference, see [04-configuration.md](04-configuration.md).

---

## Database Initialization

AuditForge uses Drizzle migrations. After the pods start, run:

```bash
kubectl exec -n auditforge deploy/auditforge-api -- \
  pnpm db:migrate
kubectl exec -n auditforge deploy/auditforge-api -- \
  pnpm db:seed:prod    # loads ISO 42001 catalogue + question library
```

Migrations are in `packages/db/drizzle/` (0001 through 0015).

---

## Verifying the Install

```bash
# Health endpoints
curl https://auditforge.example.com/healthz/ready
curl https://auditforge.example.com/healthz/live

# Chain integrity (empty on fresh install — returns 200 with empty array)
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://auditforge.example.com/v1/admin/chain/verify-all
```

---

## Post-Install Steps

1. Create the first tenant (firm) via the admin API or the Setup Wizard
   at `https://auditforge.example.com/setup`.
2. Invite the first lead auditor. They will complete passkey enrollment
   on first login.
3. Pull Ollama models (if not pre-pulled):
   ```bash
   kubectl exec -n auditforge deploy/ollama -- ollama pull llama3.1:8b
   kubectl exec -n auditforge deploy/ollama -- ollama pull qwen2.5:32b
   kubectl exec -n auditforge deploy/ollama -- ollama pull bge-m3
   ```

---

## Docker Compose (Development / Small Deployments)

```bash
git clone https://github.com/auditforge/auditforge.git
cd auditforge
cp .env.example .env        # fill in your secrets
docker compose -f infra/docker-compose.dev.yml up -d
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Web: http://localhost:3000 — API: http://localhost:4000

---

## Related Documents

- [04-configuration.md](04-configuration.md) — full env-var reference.
- [05-air-gap-deployment.md](05-air-gap-deployment.md) — offline install.
- [10-upgrades.md](10-upgrades.md) — zero-downtime upgrade procedure.
