# ADR-0021: Transactional outbox pattern for event emission

- **Status**: Accepted
- **Date**: 2026-05-10
- **Deciders**: AuditForge core
- **Phase**: 7 (data layer) → 8 (queues / workers)
- **Tags**: events, queues, consistency, bullmq

## Context

Several Wave-1 / Wave-2 features need to emit asynchronous events
*atomically* with a database write:

- A `finding.promoted` event must be enqueued for the audit ledger writer,
  the search re-indexer, and the reviewer-notification mailer iff the
  promotion row was committed.
- A `working_paper.updated` event has to fan out to Yjs-room subscribers
  iff the persisted snapshot was committed.
- A `report.published` event must trigger TSA enrichment iff the publish
  row was committed.

The naive pattern — `db.insert(); queue.publish()` — is **dual-write**
and breaks under any of (a) DB commit succeeds + queue publish fails,
(b) queue publish succeeds + DB commit rolls back, (c) the API process
crashes between the two. Either case yields a permanently-inconsistent
ledger or a phantom event.

## Decision

Adopt the **transactional outbox** pattern:

1. Every event emitter writes the event to an `outbox_events` table
   *inside the same database transaction* as the business write. The
   event is persisted as a row with `{id, aggregate_type, aggregate_id,
   topic, payload_jsonb, created_at, processed_at NULL}`.
2. A relay worker (`apps/worker`) polls `outbox_events WHERE
   processed_at IS NULL` in `id` order, publishes each event to BullMQ
   (Redis 7), and sets `processed_at = NOW()` in a second transaction.
3. Subscribers consume from BullMQ topics. They are idempotent —
   each event id is treated as a deduplication key per consumer (a
   small `consumer_offsets` table records `(consumer_id, event_id)`
   pairs after successful processing).
4. The relay worker uses `SELECT ... FOR UPDATE SKIP LOCKED` so multiple
   relay replicas can run safely.

The implementation lives in `packages/db/src/outbox.ts`; consumers live
in `apps/worker/src/consumers/`.

## Consequences

### Positive

- **At-least-once delivery is guaranteed** without losing transactional
  semantics on the business write.
- **Crash-safe.** Any uncommitted business+event pair rolls back atomically.
- **Replayable.** The outbox is the source-of-truth for event history; a
  consumer can rebuild its state by re-reading from `outbox_events`.

### Negative

- **At-least-once, not exactly-once.** Consumers must dedupe on event id.
  We pay this cost in every consumer and document it in
  `apps/worker/README.md`.
- **Polling latency.** End-to-end latency from commit to BullMQ publish
  is ~250 ms (poll interval). For interactive features (Yjs sync) we use
  Postgres `LISTEN/NOTIFY` to wake the relay worker immediately; polling
  is only the fallback.

### Neutral

- We considered Postgres logical replication (Debezium) instead of an
  outbox table. Debezium adds operational complexity (Kafka, connect)
  and is overkill for our event volume; the outbox table is one SQL
  index away from a perfectly adequate solution.

## Alternatives Considered

| Option | Why rejected |
|--------|--------------|
| Direct queue.publish() inside handler | Dual-write; no atomicity; fragile. |
| 2PC across Postgres + Redis | Postgres + Redis do not both implement XA; impossible. |
| Debezium / logical replication | Operational overhead; needs Kafka in the stack. |
| Synchronous side-effects only | Defeats the purpose of asynchronous workers. |

## Compliance Implications

- **ISO 42001 Clause 8.1** (operational planning and control): event
  delivery to the audit ledger is part of the operational control set;
  outbox proves we never lose a ledger event.
- **ISO 17021-1 Clause 9.4.10**: integrity of audit records — the audit
  ledger consumes outbox events; the outbox guarantees the ledger
  contains every promotion / publication action.

## Follow-Ups

- [ ] Phase 8: load test on the outbox relay (`load/ledger-append.js`
      target).
- [ ] Phase 8: monitoring — metric for `outbox_lag_seconds` (max age of
      a row with `processed_at IS NULL`); page the on-call if > 60 s.
- [ ] Phase 8: archival — move processed rows older than 30 days to
      cold storage.
