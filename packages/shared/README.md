# @auditforge/shared

Cross-cutting primitives shared by every AuditForge package.

Contents:
- Branded ID types (`FirmId`, `AuditorId`, `EngagementId`, ...) — nominal typing on top of UUID strings
- Common Zod validators (`Email`, `UlidSchema`, `IsoDateSchema`, `UuidSchema`)
- Domain error classes (`TenantViolation`, `AuditLedgerCorruption`, `ProbeBudgetExceeded`, ...)
- `Result<T, E>` helper for typed error returns

This package has zero runtime dependencies beyond `zod` and is safe to import from
any other package, including the database layer.
