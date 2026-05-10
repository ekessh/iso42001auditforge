<!--
SPDX-License-Identifier: BUSL-1.1
-->
<!-- metadata
section: developer-guide
audience: contributor
cross-refs:
  - docs/operator-guide/07-monitoring-and-alerting.md
  - packages/observability/
-->

# Debugging

> Common pitfalls, OTEL trace inspection, and Grafana drill-down for
> developers.

---

## Common Pitfalls

### RLS blocks a query unexpectedly

RLS is enforced at connection level. If a query returns empty results
or a permission error:

1. Check that `SET LOCAL app.tenant_id = '<uuid>'` was called before
   the query. Look at `packages/tenancy-core/src/rls.ts` for the
   session setup helper.
2. In a local Postgres shell, impersonate the app role and verify:
   ```sql
   SET app.tenant_id = 'your-test-tenant-id';
   SET ROLE auditforge_app;
   SELECT * FROM engagements;
   ```
3. If the query works as superuser but not as `auditforge_app`, the
   RLS policy is the issue.

### Ledger event not appearing in chain verify

1. Check that `signEvent()` was called (not bypassed).
2. Verify the `seq` column is monotonically increasing in the DB.
3. Run `POST /v1/admin/chain/verify-all` — it reports the first broken
   link.
4. Check `llm_invocations` to see if a background attribution job failed
   silently.

### WebSocket room not receiving updates

1. Open the browser DevTools → Network → WS and confirm the upgrade
   succeeded (HTTP 101).
2. Check the API logs for `4403` close codes (RBAC denial).
3. Verify the working paper's `team_member` record includes the current
   user.
4. Check the Redis connection — Yjs room state is in Redis if multi-
   replica API is running.

### LLM attribution returns wrong clauses

1. Check `llm_invocations` for the attribution call. Look at the
   `reasoning_trace` column (for reasoning-tier calls) to see the
   model's thinking.
2. Verify the clause catalogue is seeded (`pnpm db:seed`).
3. Run CI probe `P-AF-CLAUSE-01` locally against the failing case.

---

## OTEL Trace Inspection

Every API request, worker job, and LLM invocation is traced via
OpenTelemetry. In the local dev stack, Jaeger UI is at
http://localhost:16686.

1. Find the trace by service name (`auditforge-api`) and time range.
2. Look for spans with `llm.invocation` or `ledger.emit` operation names.
3. LLM spans include attributes: `llm.provider`, `llm.model`,
   `llm.tier`, `llm.input_tokens`, `llm.output_tokens`, `llm.latency_ms`.

For distributed traces spanning the worker:

1. The trace context propagates via BullMQ job data (`x-otel-traceparent`).
2. Search for the `worker.job` parent span and expand its children.

---

## Grafana Drill-Down

Access Grafana at http://localhost:3001 (default credentials: admin/admin
for dev).

Key drill-down paths:

| Symptom | Dashboard | Panel |
|---|---|---|
| Slow API responses | API Overview | p95 latency by route |
| High error rate | API Overview | Error rate by status code |
| Queue backing up | Worker Queue | Queue depth by name |
| LLM cost spike | LLM Invocations | Token spend by engagement |
| Ledger TSA lag | Audit Ledger | TSA anchor lag |

---

## Pino Structured Logs

All application logs are JSON (Pino). In development, `pino-pretty`
is configured for human-readable output. In production, ship raw JSON
to your log aggregator (Loki, CloudWatch, Datadog).

Key log fields:

- `tenantId` — always present on business logic logs.
- `engagementId` — present on engagement-scoped operations.
- `llmProvider`, `llmModel` — present on LLM invocation logs.
- `ledgerSeq` — present on ledger write logs.
- `err` — structured error object (message + stack).

---

## Cross-References

- [../operator-guide/07-monitoring-and-alerting.md](../operator-guide/07-monitoring-and-alerting.md)
  — production monitoring.
- [../operator-guide/11-incident-response.md](../operator-guide/11-incident-response.md)
  — escalation.
- `packages/observability/` — OTEL setup source.
