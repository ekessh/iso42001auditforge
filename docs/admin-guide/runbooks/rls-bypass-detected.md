<!-- SPDX-License-Identifier: BUSL-1.1 -->
# Runbook — `RLSBypassDetected`

**Severity:** critical (page)
**SLO:** tenant-isolation
**Alert source:** `infra/helm/auditforge/templates/prometheusrule.yaml`

## What this means

The Postgres row-level-security guard at `packages/db/src/rls.ts` detected a query path that
either bypassed the tenant filter (e.g. via the `BYPASSRLS` privilege) or was issued without a
tenant context having been set on the connection. Any non-zero `auditforge_rls_bypass_total`
increment is treated as a critical tenant-isolation incident until proven otherwise.

## Immediate actions (first 10 minutes)

1. **Acknowledge the page.**
2. **Page CISO** via PagerDuty escalation policy. This is mandatory for tenant-isolation alerts.
3. **Identify the table.** The label `table` on the counter narrows the surface; combine with
   `kubectl logs -l app=auditforge-api --since=15m | jq 'select(.message | contains("rls"))'` to
   find the offending query and the requesting user.
4. **Freeze the suspect surface.** If a single endpoint or admin tool is responsible, scale the
   deployment to 0 or route around it via Ingress.

## Investigate

1. **Authentication audit.** Was the request authenticated? Was the role used Postgres-level
   `BYPASSRLS`? Roles with `BYPASSRLS` are documented in `infra/postgres-init/rls.sql`; only
   `auditforge_admin` should have it, and that role is reserved for migrations.
2. **`pg_stat_activity`.** `kubectl exec auditforge-postgres-0 -- psql -c "select pid, usename,
   application_name, query, state from pg_stat_activity where state != 'idle';"` to see active
   sessions.
3. **`pg_audit` log.** Pull the last 24h of `pg_audit` events for the suspect role. Look for
   `SET ROLE auditforge_admin` outside of migration windows.
4. **Cross-reference traces.** In Tempo, search for spans named `auditforge.rls.set_tenant`
   missing in the last 15 minutes. Those traces point at requests that proceeded without an RLS
   context.

## Resolution

1. **Rotate Postgres role passwords** for any role implicated. The CRD is
   `infra/helm/auditforge/templates/postgres-roles.yaml`; the rotation is automated via External
   Secrets when the underlying secret is updated.
2. **Patch.** If the issue is a code path that did not run under `runWithRlsContext`, file a
   blocker bug and roll back the most recent deploy via `helm rollback auditforge`.
3. **Ledger entry.** Record an `incident.tenant_isolation_breach` ledger event for every firm
   whose data was potentially exposed. The ledger event triggers the customer-notification
   workflow per the MSA.

## Verification

`auditforge_rls_bypass_total` rate has remained at 0 for 60 minutes. Every endpoint that touches
multi-tenant data is now wrapped in `runWithRlsContext`. A burst-test that issues 1000 requests
without a tenant context returns 4xx for every request and increments the counter once per
unique table.

## Post-incident

Customer notification is mandatory if any tenant data was returned to a different tenant's user
session. Legal and CISO sign off on the notification timeline; the MSA's data-incident clause
sets the maximum delay.
