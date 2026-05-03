# ADR-0003: Postgres Row-Level Security as Defense-in-Depth Tenancy Layer

- **Status**: Accepted
- **Date**: 2026-05-03
- **Phase**: 0, 1
- **Tags**: tenancy, security

## Context

A single bug in the application layer that omits a tenant filter on a query is enough to leak audit evidence across tenants. For a CB managing multiple competing clients, that is a contract-killing event.

## Decision

Tenancy is enforced at two layers:

1. **App layer guard** — every controller resolves `firmId`, `auditorId`, and `engagementId` from the session and attaches them to the request context. Repositories require a context object on every query.

2. **Database layer** — every business table carries `firm_id` (and where relevant, `engagement_id`). Postgres Row-Level Security policies restrict SELECT/INSERT/UPDATE/DELETE based on the session-local `app.current_firm_id` and `app.current_auditor_id`. The API sets these via `SET LOCAL` on each request.

Service accounts (worker, migration) use a separate role with bypass-RLS; that role is never reachable from the request path.

Cross-firm reads (e.g., the accreditation auditor portal) use a dedicated read-only role with explicit policies.

## Consequences

### Positive
- App-layer regression cannot leak data across firms.
- Test harness can simulate tenants by setting session vars.

### Negative
- `SET LOCAL` round-trip per request adds latency (~0.1–0.3 ms).
- Policies must be added for every new table; CI lint enforces.

### Neutral
- ORM (Drizzle) supports RLS-aware sessions; helper module standardises the pattern.

## Alternatives Considered

| Option | Why rejected |
|--------|--------------|
| App-layer only | Single-bug exposure unacceptable. |
| Schema-per-tenant | DDL storm at tenant create; migrations × N tenants. |
| Database-per-tenant | Operationally heavy for a CB with 100+ clients. |

## Compliance Implications

ISO 27001 A.8.3, GDPR Art. 32, ISO 42001 A.7.

## Follow-Ups

- [ ] Test suite of RLS bypass attempts.
- [ ] CI lint: every new migration that creates a table must include a policy.
