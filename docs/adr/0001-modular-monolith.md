# ADR-0001: Modular Monolith Over Microservices (For Now)

- **Status**: Accepted
- **Date**: 2026-05-03
- **Phase**: 0
- **Tags**: architecture, deploy

## Context

Team size at launch is small (1–5 engineers). The product covers ~13 functional modules but a single audit engagement touches most of them in a tightly coupled flow (engagement → plan → working papers → findings → report → archive). Distributed transactions, cross-service event ordering, and per-service tenancy enforcement are expensive to build correctly with a small team.

## Decision

Ship a single deployable NestJS modular monolith for the API tier. Each functional module sits under `apps/api/src/modules/<name>` with its own controller, service, schema, and tests. Cross-module communication is via a typed in-process bus, never via the HTTP layer.

A separate worker process (BullMQ) handles probe execution, trace ingest, AV scans, evidence OCR, and report rendering. Worker shares the same module code via a workspace package.

We split into microservices only when (a) team ≥10 engineers, (b) a module has a divergent scaling profile (probe runner is the candidate), or (c) a regulatory boundary forces isolation.

## Consequences

### Positive
- One deploy. One DB connection pool. One auth middleware.
- Tenancy enforcement consolidated (RLS + app guard).
- Easier ADR + threat model coverage.
- Faster local dev.

### Negative
- A module fault can blast-radius the whole API.
- Per-module scaling not possible until split.
- Tempting to violate boundaries; CI must enforce.

### Neutral
- Same monorepo regardless of split path; future split is a process boundary, not a code rewrite.

## Alternatives Considered

| Option | Why rejected |
|--------|--------------|
| Microservices from day 1 | Massive ops + tracing investment; team too small. |
| Serverless functions | Audit ledger needs strong consistency + long-running probe jobs; serverless cold start hurts. |
| One process for everything (no worker) | Long-running probe jobs would starve the API request loop. |

## Compliance Implications

ISO 17021-1 9.4 (audit reporting) needs deterministic state — easier in a single process with one DB transaction.

## Follow-Ups

- [ ] Boundary-violation lint rule (eslint-plugin-boundaries).
- [ ] Document the in-process bus contract.
