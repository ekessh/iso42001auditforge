# @auditforge/surveillance

AuditForge ISO 42001 — **Continuous Surveillance** package (Phase 11, Section 3.11).

License: BUSL-1.1

## Purpose

For scheme owners and certification bodies that support continuous certification, this
package implements:

- **Auditee Telemetry Hook** — opt-in, signed, rate-limited stream of metrics
- **Threshold Alerting** — auditor-configured thresholds with hysteresis to prevent flap
- **Risk Re-Scoring** — continuous risk recalculation that influences next surveillance scope
- **Incident Watch** — auditee AI incidents (per A.5.5) feed into the next surveillance plan

## Design constraints

The telemetry ingest path is **hardened**:

1. HMAC-SHA256 signed requests (per-tenant secret).
2. Replay protection via nonce + bounded timestamp window.
3. Per-tenant token-bucket rate limiting.
4. Strict Zod schema validation per metric type — malformed payloads are rejected
   without crashing.
5. Idempotent dedup keyed by `(tenantId, payload.id)`.

All services are pure TypeScript with **no hard-coded transports**: the
`AlertDispatcher` accepts injected channel sinks (email, Slack, webhook) so this
package stays free of network dependencies and remains unit-testable.

## Modules

| File | Responsibility |
|------|---------------|
| `domain.ts` | Zod schemas + types: `TelemetryStream`, `TelemetryPayload`, `Threshold`, `SurveillanceAlert`, `RiskRescore`, `IncidentRecord` |
| `signing.ts` | Canonical HMAC-SHA256 signing + verification, replay window check |
| `rate-limit.ts` | Per-tenant token bucket |
| `telemetry-ingest.ts` | End-to-end ingest pipeline (verify -> rate-limit -> validate -> dedup) |
| `threshold-evaluator.ts` | Rolling-window threshold breach with hysteresis state machine |
| `alert-dispatcher.ts` | Multi-channel pluggable dispatcher |
| `risk-score-engine.ts` | Deterministic risk recomputation from telemetry + incidents |
| `scope-adjuster.ts` | Proposes next surveillance scope from alerts + carry-forward NCs |
| `incident-watch.ts` | Subscribes to A.5.5 incident events, surfaces in next plan |

## Metric types

The package recognises eight first-class metric kinds, each with its own Zod schema:

1. `probe_rollup`
2. `drift_indicator`
3. `incident_rate`
4. `latency`
5. `cost`
6. `model_update`
7. `safety_eval`
8. `availability`

## Status

All deliverables for Phase 11 implemented; 40+ unit tests covering replay attacks,
schema fuzzing, hysteresis, risk recomputation determinism, scope adjustment, and
rate limiting under burst.
