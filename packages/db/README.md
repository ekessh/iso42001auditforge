# @auditforge/db

Drizzle ORM schema, migrations, and seeders for the full ~65-table AuditForge
data model (Section 5 of `auditforge.md`).

## Layout

```
src/
  schema/
    firms.ts            auditors.ts          clients.ts
    engagements.ts      ai_systems.ts        agent_workflows.ts
    catalogues.ts       soa.ts               risk.ts
    working_papers.ts   samples.ts           evidence.ts
    interviews.ts       probes.ts            traces.ts
    findings.ts         capa.ts              reports.ts
    peer_review.ts      archive.ts           ledger.ts
    billing.ts          surveillance.ts      co_auditor.ts
    _shared.ts          (column helpers)
    index.ts            (barrel)
  seed/
    index.ts            roles.ts             catalogues.ts
  client.ts             pg + postgres-js wiring
drizzle/
  0000_extensions.sql           hand-written
  0001_rls_policies.sql         hand-written
  0002_init_schema.sql          generated
```

## Usage

```bash
pnpm --filter @auditforge/db generate    # produce migration from schema
pnpm --filter @auditforge/db migrate     # apply
pnpm --filter @auditforge/db seed        # roles + catalogues
pnpm --filter @auditforge/db test        # Testcontainers integration tests
```

## Roles

- `app_service_role` — bypasses RLS, used by migrations and workers.
- `app_request_role` — subject to RLS, used by API requests.

## Tenancy

Every business table carries `firm_id`. RLS policies require the
`app.current_firm_id` session var. Use `set_tenant_context(firm uuid, auditor uuid)`
to enter, `clear_tenant_context()` to exit. See `@auditforge/tenancy-core`.
