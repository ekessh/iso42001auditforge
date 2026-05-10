# ADR-0023: Yjs Y-websocket transport with per-room RBAC and IndexedDB persistence

- **Status**: Accepted
- **Date**: 2026-05-10
- **Deciders**: AuditForge core, working-papers lead
- **Phase**: 7.6 (conversational workspace) → 8 (offline)
- **Tags**: collaboration, crdt, offline, websocket, rbac

## Context

`CLAUDE.md` mandates "Sync: Yjs CRDT" and "Offline-first for working
papers". Wave-1 had to choose:

1. The transport binding (Y-websocket vs Y-WebRTC vs Y-protocols /
   Y-redis bridge).
2. The offline persistence layer (IndexedDB via `y-indexeddb` vs
   custom).
3. The authorization model — Yjs-side has *no* concept of access control,
   so every room subscription needs to be gated.
4. The recovery model when the auditor's local replica diverges from the
   server while offline.

## Decision

- **Transport**: `y-websocket` over the API's WebSocket gateway.
  Y-WebRTC is rejected (NAT traversal complexity, no central audit
  trail, hard to RBAC). The API runs the canonical y-websocket server
  inside `apps/api` so the same auth context (ADR-0017 RLS session
  vars) applies to room subscriptions.
- **Per-room RBAC**: every WebSocket upgrade carries the auditor's
  session token; the API resolves
  `(principal, working_paper_id) → role` via `packages/auth-core` and
  rejects the upgrade with `4403` close code on deny. Membership is
  checked **on every message** for write traffic (a malicious client
  cannot escalate by sending a write after losing access).
- **Offline persistence**: `y-indexeddb` for the working-paper Doc
  binary. The IndexedDB store is namespaced per `(firmId, userId,
  workingPaperId)` so a multi-tenant device cannot cross-leak.
- **Conflict resolution**: Yjs's CRDT semantics are sufficient for text
  and rich text. For structured fields (clause-link annotations,
  evidence drawer entries) we use Yjs `Y.Map` with merge functions; on
  reconnect, the server replays the offline ops and writes a single
  ledger event per Doc with the diff summary.

## Consequences

### Positive

- **True offline edits.** An auditor on-site without connectivity can
  edit a working paper, capture evidence, and the changes converge on
  reconnect.
- **Single auth model.** RBAC is the same as the REST API; no separate
  Yjs-side auth scheme to maintain.
- **Mature library set.** Y-websocket and y-indexeddb are battle-tested
  in real-time editor use cases.

### Negative

- **No native end-to-end encryption.** Yjs ops travel through the API.
  We accept this — the API already has access to the plaintext via
  RLS-bypassing aggregations for indexing — but it means the API
  process is in the trust boundary for working papers.
- **Per-message auth check.** Every write costs an extra cache lookup;
  we mitigate with a 30-second LRU cache keyed on
  `(token, workingPaperId)`.
- **Storage bloat.** IndexedDB Doc binaries grow with edit history;
  we run a compaction job that snapshots a Doc to a "checkpoint" and
  prunes pre-checkpoint deltas after 7 days.

### Neutral

- We chose Y-websocket over a Yjs-on-WebTransport prototype because
  WebTransport browser support is still uneven and Y-websocket works
  through corporate proxies.

## Alternatives Considered

| Option | Why rejected |
|--------|--------------|
| Y-WebRTC | No central audit trail; NAT traversal hassles; per-room access control complex. |
| Operational Transform (ShareDB) | Not a CRDT; harder offline story; less mature TypeScript ecosystem. |
| Custom CRDT | Re-inventing Yjs poorly; no upside. |
| Server-side CRDT only (no offline) | Violates `CLAUDE.md` offline-first mandate. |

## Compliance Implications

- **ISO 27001 A.13.2.1** (information transfer policies): WebSocket
  uses TLS 1.3; RBAC at the room level enforces need-to-know.
- **ISO 42001 Clause 8.2** (operational planning and control): offline
  edits are not lost; the audit trail is preserved across connectivity
  gaps.
- **ISO 17021-1 Clause 9.2.3.4** (audit trail): every Doc commit
  produces a ledger event so the working-paper history is
  reconstructable from the ledger alone.

## Follow-Ups

- [ ] Phase 8: ledger replay test — given a sequence of Yjs ops in the
      ledger, the chain verifier can reconstruct the final Doc state.
- [ ] Phase 8: e2e test for two-browser collaborative edit
      (`tests/e2e/journeys/wave3-working-paper-collab.spec.ts`).
- [ ] Phase 14: server-side compaction policy review.
