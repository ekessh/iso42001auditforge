# @auditforge/audit-engine

Event-sourced, hash-chained, TSA-stub audit ledger. See ADR-0002.

## Concepts

- **Event registry** — Zod-based schema registry. Every event type is registered
  with a version number. Events whose type or shape is not in the registry are
  rejected on emit.
- **Hash chain** — each event stores `prevHash` and `chainHash`. `chainHash` is
  the SHA-256 of `prevHash || canonicalJson(payload)`. Tampering with any
  historical event invalidates every subsequent `chainHash`.
- **Per-tenant sequences** — events carry `firmId` and a monotonic
  `sequenceNumber` per firm.
- **TSA stub** — `signWithTSA` returns a placeholder timestamp token. Phase 12
  swaps in a real RFC 3161 TSA client.
- **Replay** — `replayEvents` rebuilds projections deterministically from the
  filtered event stream.

## API

```ts
const ledger = new AuditLedger(repo, registry);
await ledger.emit(ctx, 'engagement.created', { engagementId, scope });
await ledger.verifyChain({ firmId });
const projection = await ledger.replay({ firmId }, reducer, initial);
```

The `EventRepository` is an interface so the engine works equally well with
Drizzle/Postgres in production and an in-memory store in tests.
