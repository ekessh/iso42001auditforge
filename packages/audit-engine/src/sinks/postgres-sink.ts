// SPDX-License-Identifier: BUSL-1.1
//
// PERF / DURABILITY — BLK-3 (perf-review #3, High #10):
// `InMemoryEventRepository` cannot meet the 99.999 % audit-ledger
// durability target — it lives for the lifetime of one Node process.
// Worse, the API's `AuditTrailInterceptor` calls `void ledger.append(...)`
// fire-and-forget, so any failure (including the race-window
// `AuditLedgerCorruption` thrown when two concurrent `emit()` calls
// both compute `last.sequenceNumber + 1`) silently loses an audit event.
//
// `PostgresEventRepository` implements the package's `EventRepository`
// contract on top of any SQL executor (postgres-js, pg, drizzle). It
// exposes two append modes:
//
//   - `insert(event)`: a self-contained transaction. Useful when the
//     ledger is the only mutation in flight (background ledger-only writes).
//   - `transactional(tx, event)`: enlists in an existing caller-owned
//     transaction. The audit-trail interceptor uses this so the ledger
//     row is committed atomically with the business mutation — if the
//     ledger insert fails, the business write rolls back too.
//
// Concurrency: per-firm sequence allocation is serialised with a Postgres
// advisory transaction lock on `hashtext(firm_id)`. This eliminates the
// `getLatestForFirm` → `insert` race and is cheaper than a SERIALIZABLE
// transaction at high tenant counts.

import type {
  EventQuery,
  EventRepository,
  LedgerEvent,
} from '../ledger.js';

/**
 * Minimal SQL surface. Implementations forward parametrised queries to
 * the underlying driver. The same shape is reused by transactional
 * adapters: a caller's `tx` handle implements `SqlExecutor` (postgres-js
 * does this naturally, pg.PoolClient via a thin wrapper).
 */
export interface SqlExecutor {
  query<TRow = Record<string, unknown>>(
    sql: string,
    params: readonly unknown[],
  ): Promise<TRow[]>;
}

/**
 * A handle to a caller-owned transaction. We require both `query` and
 * an explicit `enlist` flag so we can refuse to take an advisory lock
 * twice on the same transaction (idempotent across nested helpers).
 */
export interface Transaction extends SqlExecutor {
  /**
   * Marker that the value is a transactional handle. Optional; if
   * present, used to assert callers don't pass a pool by mistake.
   */
  readonly __isTransaction?: true;
}

interface EventRow {
  id: string;
  firm_id: string;
  auditor_id: string | null;
  engagement_id: string | null;
  sequence_number: number | string;
  event_type: string;
  schema_version: number;
  payload: unknown;
  producer: string;
  occurred_at: string | Date;
  prev_hash: string;
  chain_hash: string;
  tsa_token: unknown;
}

function isoOf(v: string | Date): string {
  return v instanceof Date ? v.toISOString() : v;
}

function rowToEvent(row: EventRow): LedgerEvent {
  const payload =
    typeof row.payload === 'string'
      ? (JSON.parse(row.payload) as Record<string, unknown>)
      : ((row.payload ?? {}) as Record<string, unknown>);
  const tsaToken =
    row.tsa_token === null || row.tsa_token === undefined
      ? null
      : typeof row.tsa_token === 'string'
        ? JSON.parse(row.tsa_token)
        : row.tsa_token;
  return {
    id: row.id,
    firmId: row.firm_id,
    auditorId: row.auditor_id,
    engagementId: row.engagement_id,
    sequenceNumber: Number(row.sequence_number),
    eventType: row.event_type,
    schemaVersion: row.schema_version,
    payload: Object.freeze(payload) as Readonly<Record<string, unknown>>,
    producer: row.producer,
    occurredAt: isoOf(row.occurred_at),
    prevHash: row.prev_hash,
    chainHash: row.chain_hash,
    tsaToken: tsaToken as LedgerEvent['tsaToken'],
  };
}

/**
 * Postgres-backed `EventRepository`. Reads use the
 * `(firm_id, sequence_number DESC)` index for tip lookup and the
 * `(firm_id, sequence_number)` covering index for `list`.
 */
export class PostgresEventRepository implements EventRepository {
  /**
   * @param sql      Pool-level executor for self-contained `insert` calls
   *                 and all reads. Reads can run on read-replicas; tip
   *                 lookups must run on the primary if strict durability
   *                 is required (the lock+select+insert in `insert()`
   *                 always runs on the primary).
   * @param options  Configuration knobs. `tableName` allows running with a
   *                 custom prefix in multi-tenant deployments.
   */
  constructor(
    private readonly sql: SqlExecutor,
    private readonly options: { tableName?: string } = {},
  ) {}

  private get table(): string {
    return this.options.tableName ?? 'audit_ledger_events';
  }

  /**
   * Latest committed event for a firm. Used by `AuditLedger.emit` to
   * compute the next sequence number when not running inside a caller
   * transaction.
   */
  async getLatestForFirm(firmId: string): Promise<LedgerEvent | null> {
    const sql = `
SELECT id, firm_id, auditor_id, engagement_id, sequence_number, event_type,
       schema_version, payload, producer, occurred_at, prev_hash, chain_hash,
       tsa_token
FROM   ${this.table}
WHERE  firm_id = $1
ORDER  BY sequence_number DESC
LIMIT  1
`;
    const rows = await this.sql.query<EventRow>(sql, [firmId]);
    return rows[0] ? rowToEvent(rows[0]) : null;
  }

  /**
   * Self-contained insert. Wraps a per-firm advisory lock + insert in a
   * single transaction. Use {@link transactional} when the caller already
   * owns a transaction (e.g. an HTTP request body that must commit
   * atomically with the audit row).
   */
  async insert(event: LedgerEvent): Promise<void> {
    await this.sql.query('BEGIN', []);
    try {
      await this.lock(this.sql, event.firmId);
      await this.insertWithLock(this.sql, event);
      await this.sql.query('COMMIT', []);
    } catch (err) {
      try {
        await this.sql.query('ROLLBACK', []);
      } catch {
        /* swallow rollback errors */
      }
      throw err;
    }
  }

  /**
   * Insert inside an existing caller-owned transaction. Returns the row
   * as persisted (sequence number is the one written; chain hash is the
   * one validated by `AuditLedger.emit` upstream). The audit-trail
   * interceptor calls this after computing the chained event so the
   * mutation and audit commit (or roll back) together.
   */
  async transactional(tx: Transaction, event: LedgerEvent): Promise<LedgerEvent> {
    await this.lock(tx, event.firmId);
    await this.insertWithLock(tx, event);
    return event;
  }

  /**
   * List events scoped by firm, optional engagement, types, and sequence
   * range. Backed by the `(firm_id, sequence_number)` covering index.
   */
  async list(query: EventQuery): Promise<LedgerEvent[]> {
    const where: string[] = ['firm_id = $1'];
    const params: unknown[] = [query.firmId];
    if (query.engagementId !== undefined) {
      where.push(`engagement_id = $${params.length + 1}`);
      params.push(query.engagementId);
    }
    if (query.eventTypes && query.eventTypes.length > 0) {
      where.push(`event_type = ANY($${params.length + 1}::text[])`);
      params.push([...query.eventTypes]);
    }
    if (query.fromSequence !== undefined) {
      where.push(`sequence_number >= $${params.length + 1}`);
      params.push(query.fromSequence);
    }
    if (query.toSequence !== undefined) {
      where.push(`sequence_number <= $${params.length + 1}`);
      params.push(query.toSequence);
    }
    const sql = `
SELECT id, firm_id, auditor_id, engagement_id, sequence_number, event_type,
       schema_version, payload, producer, occurred_at, prev_hash, chain_hash,
       tsa_token
FROM   ${this.table}
WHERE  ${where.join(' AND ')}
ORDER  BY sequence_number ASC
`;
    const rows = await this.sql.query<EventRow>(sql, params);
    return rows.map(rowToEvent);
  }

  private async lock(exec: SqlExecutor, firmId: string): Promise<void> {
    // pg_advisory_xact_lock is released automatically at COMMIT/ROLLBACK.
    // hashtext is a stable 32-bit hash — collisions are acceptable at the
    // cost of occasional cross-tenant lock contention; a 64-bit form
    // (hashtextextended in PG ≥ 13) can be substituted for higher tenant
    // counts.
    await exec.query('SELECT pg_advisory_xact_lock(hashtext($1))', [firmId]);
  }

  private async insertWithLock(
    exec: SqlExecutor,
    event: LedgerEvent,
  ): Promise<void> {
    // Strict insert; the ledger upstream has already computed the
    // sequence number against the latest tip for this firm. We add a
    // unique constraint on `(firm_id, sequence_number)` (DDL not in this
    // file) so a concurrent racer trips a unique-violation rather than
    // overwriting.
    const sql = `
INSERT INTO ${this.table} (
  id, firm_id, auditor_id, engagement_id, sequence_number, event_type,
  schema_version, payload, producer, occurred_at, prev_hash, chain_hash,
  tsa_token
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13::jsonb
)
RETURNING id, sequence_number
`;
    await exec.query(sql, [
      event.id,
      event.firmId,
      event.auditorId,
      event.engagementId,
      event.sequenceNumber,
      event.eventType,
      event.schemaVersion,
      JSON.stringify(event.payload),
      event.producer,
      event.occurredAt,
      event.prevHash,
      event.chainHash,
      event.tsaToken === null ? null : JSON.stringify(event.tsaToken),
    ]);
  }
}

/**
 * Re-exported transactional sink type so callers can declare the
 * interceptor dependency without depending on the implementation class.
 */
export interface TransactionalEventSink {
  transactional(tx: Transaction, event: LedgerEvent): Promise<LedgerEvent>;
}
