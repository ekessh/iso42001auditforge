# ADR-0004: Offline-First Working Papers via CRDT (Yjs)

- **Status**: Accepted
- **Date**: 2026-05-03
- **Phase**: 0, 4
- **Tags**: offline, sync, ux

## Context

Auditors work onsite — sometimes in SCIFs, sometimes on industrial floors with no Wi-Fi. Losing a day of working paper edits because the connection dropped is unacceptable. Two team auditors editing the same working paper concurrently must merge cleanly.

## Decision

Working papers, findings drafts, observation notes, and interview notes use Yjs CRDTs. The desktop (Tauri) and mobile (PWA) clients hold a full local replica per engagement. Sync runs over a y-websocket / Hocuspocus channel when online.

Conflicts that CRDT cannot auto-resolve (e.g., conflicting verdicts on the same WP) surface in a "Reconcile" UI. The audit ledger captures every accepted update so reconciliation is auditable.

Read-only data (reference catalogues, plan, evidence binary URLs) is cached locally but is not CRDT — the server is the source of truth.

## Consequences

### Positive
- Offline-first is a feature, not a workaround.
- Multi-auditor concurrent editing is a non-event for most fields.
- Replay-based audit trail still applies.

### Negative
- CRDT footprint per engagement (~MBs); needs eviction policy on mobile.
- Custom conflict UI required for non-mergeable fields.
- Backfilling history into the ledger from CRDT requires care.

### Neutral
- Yjs is mature and TypeScript-first; provider choice (y-websocket vs Hocuspocus) deferred.

## Alternatives Considered

| Option | Why rejected |
|--------|--------------|
| Last-write-wins | Drops auditor work without warning. |
| OT (operational transform) | Server-centric, harder for offline-first. |
| Plain offline cache + manual merge | Bad UX during a live audit. |

## Compliance Implications

ISO 17021-1 9.4 (record completeness) — every accepted update is in the ledger.

## Follow-Ups

- [ ] Choose Hocuspocus vs y-websocket.
- [ ] Mobile eviction policy.
- [ ] Reconcile UI prototype.
