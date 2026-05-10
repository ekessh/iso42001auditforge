<!--
SPDX-License-Identifier: BUSL-1.1
-->

# Upgrades

> Zero-downtime upgrade procedure, Drizzle schema migration sequence,
> and rollback gates.

---

## Migration History

Drizzle migrations are in `packages/db/drizzle/`. Applied in order:

| Migration | Description |
|---|---|
| 0001 | Initial schema: tenants, users, engagements, audit_ledger_events |
| 0002 | Working papers, evidence_files, findings |
| 0003 | Probe results, probes catalogue |
| 0004 | Claim graph: claims, claim_relations, episodes |
| 0005 | bi-temporal columns on claims (event_time_start/end, ingestion_time) |
| 0006 | LLM invocations ledger |
| 0007 | Interview sessions, transcript utterances |
| 0008 | Peer review, QA checklist |
| 0009 | CAPA records |
| 0010 | Sampling records |
| 0011 | Surveillance engagements, SoA |
| 0012 | Cross-framework mappings |
| 0013 | Signing keys registry |
| 0014 | Consent registry |
| 0015 | Cross-engagement memory (anonymized pattern store) |

---

## Pre-Upgrade Checklist

Before any upgrade:

- [ ] Read the release notes for the target version.
- [ ] Verify no breaking schema changes affect custom integrations.
- [ ] Take a Postgres backup (follow [06-backup-and-restore.md](06-backup-and-restore.md)).
- [ ] Confirm `GET /healthz/ready` returns 200 on all current pods.
- [ ] Run `POST /v1/admin/chain/verify-all` and confirm zero errors.

---

## Zero-Downtime Upgrade Procedure

AuditForge uses additive schema migrations and a rolling deployment
strategy:

1. **Apply the migration against the live database** (before updating
   the application):
   ```bash
   kubectl exec -n auditforge deploy/auditforge-api -- \
     pnpm db:migrate
   ```
   Additive migrations (add column with default, add table) are safe
   on the live database while the old app version runs.

2. **Update the Helm release**:
   ```bash
   helm upgrade auditforge auditforge/auditforge \
     --namespace auditforge \
     --values my-values.yaml \
     --atomic \
     --timeout 5m
   ```
   `--atomic` rolls back automatically if pods do not become ready
   within the timeout.

3. **Rolling restart** (if not triggered by Helm):
   ```bash
   kubectl rollout restart deployment/auditforge-api -n auditforge
   kubectl rollout restart deployment/auditforge-worker -n auditforge
   ```

4. **Verify**:
   ```bash
   kubectl rollout status deployment/auditforge-api -n auditforge
   curl https://auditforge.example.com/healthz/ready
   curl https://auditforge.example.com/v1/admin/chain/verify-all \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

---

## Rollback

If a deployment fails:

```bash
helm rollback auditforge --namespace auditforge
```

If a migration cannot be rolled back (destructive migration — AuditForge
avoids these by design, but if one occurs):

1. Restore Postgres from the pre-upgrade backup.
2. Deploy the previous Helm chart version.
3. Verify chain integrity.

---

## Related Documents

- [06-backup-and-restore.md](06-backup-and-restore.md) — pre-upgrade
  backup.
- `packages/db/drizzle/` — migration source files.
