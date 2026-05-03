# ADR-0002: Event-Sourced, Hash-Chained, TSA-Signed Audit Ledger

- **Status**: Accepted
- **Date**: 2026-05-03
- **Phase**: 0
- **Tags**: audit-integrity, security, persistence

## Context

ISO 17021-1 requires that audit records be authentic, complete, and protected from unauthorized alteration. Accreditation auditors may inspect files years after issuance. Long-term verifiability of digital signatures requires extended timestamping.

A traditional CRUD model loses history (or hides it in audit columns), is hard to prove tamper-free, and is brittle to schema migration over a 10-year retention horizon.

## Decision

All state changes to engagements, plans, working papers, findings, NC/CAPA, evidence linkage, probe runs, peer review, and report issuance are emitted as immutable events into `audit_ledger_events`. Each event carries:

- monotonic per-tenant sequence number,
- payload (JSON, validated against a schema registry),
- producer (auditor/system principal),
- previous-event hash and chain-tip hash (SHA-256),
- TSA timestamp token (RFC 3161) for events at audit-file freeze.

Read models (the operational tables) are projections rebuilt from the ledger. The ledger is append-only enforced by DB trigger + RLS + per-row signature.

For long-term archive, we use CAdES-LT / PAdES-LTV with multiple TSA providers and an annual signature-renewal job.

## Consequences

### Positive
- Tamper detection is mechanical (replay + verify chain).
- Accreditation inspection is straightforward.
- Replay enables post-hoc investigation and migration safety.

### Negative
- Two-write cost for every mutation (event + projection).
- Schema evolution requires versioned event types.
- Tooling discipline: contributors must emit events, not raw UPDATEs.

### Neutral
- Storage growth is bounded; partitioned by month with `pg_partman`.

## Alternatives Considered

| Option | Why rejected |
|--------|--------------|
| Audit columns on every table | No tamper protection; history hard to query. |
| Temporal tables (Postgres extension) | Lacks signature/TSA story. |
| External SIEM only | Doesn't bind to product state machine; no replay. |

## Compliance Implications

ISO 17021-1 9.4 / 9.5; IAF MD 5; eIDAS for signature long-term validation.

## Follow-Ups

- [ ] Pick TSA providers (commercial + free fallback).
- [ ] Design event-schema registry + versioning.
- [ ] Document the renewal job runbook.
