# @auditforge/tenancy-core

Postgres Row-Level Security session helpers. See ADR-0003.

## API

### `withTenantContext(executor, ctx, fn)`
Runs `fn` inside a transaction, executing `set_tenant_context(firmId, auditorId)`
at the start. The helper re-throws any exception thrown inside `fn` after the
transaction has been rolled back, ensuring the tenant session vars never leak.

The `executor` is a generic `TransactionExecutor` interface (a thin abstraction
over Drizzle / pg / postgres-js); your application package wires it.

### `tenantGuard(req, requestedFirmId)`
Framework-agnostic guard. Throws `TenantViolation` when the requested resource
firm differs from the session firm.

### `assertSameFirm(a, b)`
Defence-in-depth helper for cross-row joins (e.g., a working paper must belong
to the same firm as the engagement it references).
