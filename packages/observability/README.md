# @auditforge/observability

Shared observability primitives for the AuditForge ISO 42001 platform.

This package is part of AuditForge's open-core layer. The package is dual
licensed under Apache-2.0 (for the open core distribution) and BUSL-1.1
(when shipped as part of the proprietary commercial bundle). Per-file SPDX
headers indicate the effective license for each file.

Public API:

- `initOtel({ serviceName, serviceVersion, environment, otlpEndpoint, sampler })` — start the Node OTel SDK
  with auto-instrumentations (HTTP, Postgres, Redis, BullMQ producers and consumers), a parent-based
  `TraceIdRatioBased` sampler, and a `Resource` carrying `service.*`, `deployment.environment`, and
  low-cardinality `auditforge.*` attributes (never raw tenant ids).
- `createLogger(opts)` — pino factory pre-wired with a trace-id mixin (reads the active OTel span context),
  redaction of headers, bodies, prompts, signatures, JWTs, and presigned URLs.
- `getRegistry()` / `metrics` — canonical `prom-client` registry exposing 19 named series covering API
  latency, DB queries, LLM cost & latency, probe runner health, ledger durability & chain verification,
  RLS bypass attempts, AV scan availability, signature renewal pipeline, backup age, and corpus eval
  metrics (attribution precision, claim-extraction F1, contradiction precision).
- `withSpan` / `withCriticalSpan` — typed wrappers used at ledger emit, RLS context, probe execution,
  and LLM call sites.
- `correlateLedgerEvent(eventId)` — attaches the audit-ledger event id to the active OTel span and to
  the next pino log line, completing the request-id ↔ ledger-event-id ↔ trace-id chain.

This package never depends on Nest, Fastify, or any framework. Consumers wire it from their entrypoint.
