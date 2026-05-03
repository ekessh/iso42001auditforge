// SPDX-License-Identifier: BUSL-1.1
//
// BLK-3 tests for `PostgresEventRepository`. We use a hand-rolled mock
// SQL executor that records every query so we can assert the advisory
// lock + insert ordering and the parameter shape without a live DB.
// Testcontainers can be wired here later for integration coverage.

import { describe, expect, it, beforeEach } from 'vitest';
import {
  AuditLedger,
  createDefaultRegistry,
  type LedgerEvent,
} from '../src/index.js';
import {
  PostgresEventRepository,
  type SqlExecutor,
  type Transaction,
} from '../src/sinks/postgres-sink.js';

const FIRM = '11111111-1111-1111-1111-111111111111';
const FIRM_B = '22222222-2222-2222-2222-222222222222';

interface Recorded {
  sql: string;
  params: readonly unknown[];
}

class MockSql implements SqlExecutor {
  public calls: Recorded[] = [];
  public rows: Record<string, unknown>[] = [];
  public failOnInsert = false;
  async query<TRow = Record<string, unknown>>(
    sql: string,
    params: readonly unknown[],
  ): Promise<TRow[]> {
    this.calls.push({ sql, params });
    if (sql.startsWith('SELECT pg_advisory_xact_lock')) return [] as TRow[];
    if (sql.includes('INSERT INTO')) {
      if (this.failOnInsert) throw new Error('insert failed (mock)');
      return [] as TRow[];
    }
    if (sql.startsWith('BEGIN') || sql.startsWith('COMMIT') || sql.startsWith('ROLLBACK')) {
      return [] as TRow[];
    }
    if (sql.includes('ORDER  BY sequence_number DESC')) {
      return this.rows as TRow[];
    }
    if (sql.includes('ORDER  BY sequence_number ASC')) {
      return this.rows as TRow[];
    }
    return [] as TRow[];
  }
}

class MockTx extends MockSql implements Transaction {
  readonly __isTransaction = true as const;
}

function fakeEvent(seq: number, firmId = FIRM): LedgerEvent {
  return {
    id: `00000000-0000-0000-0000-${seq.toString().padStart(12, '0')}`,
    firmId,
    auditorId: null,
    engagementId: null,
    sequenceNumber: seq,
    eventType: 'audit.trail.v1',
    schemaVersion: 1,
    payload: Object.freeze({ a: seq }),
    producer: 'test',
    occurredAt: '2030-01-01T00:00:00.000Z',
    prevHash: 'GENESIS_PLACEHOLDER',
    chainHash: 'CHAIN_HASH_PLACEHOLDER',
    tsaToken: null,
  };
}

describe('PostgresEventRepository', () => {
  let mock: MockSql;
  let repo: PostgresEventRepository;
  beforeEach(() => {
    mock = new MockSql();
    repo = new PostgresEventRepository(mock);
  });

  it('insert wraps BEGIN/lock/INSERT/COMMIT in order', async () => {
    await repo.insert(fakeEvent(1));
    const sqls = mock.calls.map((c) => c.sql);
    expect(sqls[0]).toBe('BEGIN');
    expect(sqls[1]).toContain('pg_advisory_xact_lock');
    expect(sqls[2]).toContain('INSERT INTO audit_ledger_events');
    expect(sqls[3]).toBe('COMMIT');
  });

  it('insert rolls back on failure and rethrows', async () => {
    mock.failOnInsert = true;
    await expect(repo.insert(fakeEvent(1))).rejects.toThrow(/insert failed/);
    const sqls = mock.calls.map((c) => c.sql);
    expect(sqls).toContain('ROLLBACK');
  });

  it('transactional uses caller tx without BEGIN/COMMIT', async () => {
    const tx = new MockTx();
    await repo.transactional(tx, fakeEvent(7));
    const sqls = tx.calls.map((c) => c.sql);
    // Must NOT start its own transaction.
    expect(sqls.some((s) => s === 'BEGIN' || s === 'COMMIT')).toBe(false);
    // Must take the lock and insert in order.
    expect(sqls[0]).toContain('pg_advisory_xact_lock');
    expect(sqls[1]).toContain('INSERT INTO audit_ledger_events');
  });

  it('transactional propagates insert failure to caller (forces rollback up-stack)', async () => {
    const tx = new MockTx();
    tx.failOnInsert = true;
    await expect(repo.transactional(tx, fakeEvent(1))).rejects.toThrow();
  });

  it('getLatestForFirm parses driver rows into LedgerEvent', async () => {
    mock.rows = [
      {
        id: '00000000-0000-0000-0000-000000000001',
        firm_id: FIRM,
        auditor_id: null,
        engagement_id: null,
        sequence_number: 42,
        event_type: 'audit.trail.v1',
        schema_version: 1,
        payload: { foo: 'bar' },
        producer: 'p',
        occurred_at: '2030-02-01T00:00:00.000Z',
        prev_hash: 'p',
        chain_hash: 'c',
        tsa_token: null,
      },
    ];
    const evt = await repo.getLatestForFirm(FIRM);
    expect(evt?.sequenceNumber).toBe(42);
    expect(evt?.payload).toEqual({ foo: 'bar' });
  });

  it('getLatestForFirm returns null on empty result', async () => {
    mock.rows = [];
    const evt = await repo.getLatestForFirm(FIRM_B);
    expect(evt).toBeNull();
  });

  it('list builds parametrised WHERE for engagement + types + sequence range', async () => {
    await repo.list({
      firmId: FIRM,
      engagementId: '99999999-9999-9999-9999-999999999999',
      eventTypes: ['firm.created', 'auditor.invited'],
      fromSequence: 10,
      toSequence: 100,
    });
    const last = mock.calls[mock.calls.length - 1]!;
    expect(last.sql).toContain('engagement_id = $2');
    expect(last.sql).toContain('event_type = ANY($3::text[])');
    expect(last.sql).toContain('sequence_number >= $4');
    expect(last.sql).toContain('sequence_number <= $5');
    expect(last.params[0]).toBe(FIRM);
    expect(last.params[1]).toBe('99999999-9999-9999-9999-999999999999');
    expect(last.params[2]).toEqual(['firm.created', 'auditor.invited']);
    expect(last.params[3]).toBe(10);
    expect(last.params[4]).toBe(100);
  });

  it('plays nicely with AuditLedger.emit when used as the repository', async () => {
    // Stage a tip row for FIRM so the next emit becomes seq=2.
    mock.rows = [
      {
        id: '00000000-0000-0000-0000-000000000001',
        firm_id: FIRM,
        auditor_id: null,
        engagement_id: null,
        sequence_number: 1,
        event_type: 'firm.created',
        schema_version: 1,
        payload: { firmId: FIRM, name: 'A' },
        producer: 'test',
        occurred_at: '2030-01-01T00:00:00.000Z',
        prev_hash: 'GENESIS',
        chain_hash: 'h1',
        tsa_token: null,
      },
    ];
    const ledger = new AuditLedger(repo, createDefaultRegistry());
    const evt = await ledger.emit(
      { firmId: FIRM, producer: 'test' },
      'firm.created',
      { firmId: FIRM, name: 'B' },
    );
    expect(evt.sequenceNumber).toBe(2);
    expect(evt.prevHash).toBe('h1');
    // Sanity: BEGIN/lock/INSERT/COMMIT was issued.
    const insertCall = mock.calls.find((c) => c.sql.includes('INSERT INTO'));
    expect(insertCall).toBeDefined();
    // sequence_number is param 5 in the insert.
    expect(insertCall?.params[4]).toBe(2);
  });

  it('respects custom tableName option', async () => {
    const r = new PostgresEventRepository(mock, { tableName: 'tenant1.audit_events' });
    await r.list({ firmId: FIRM });
    const last = mock.calls[mock.calls.length - 1]!;
    expect(last.sql).toContain('FROM   tenant1.audit_events');
  });

  it('insert serialises sequence_number, occurred_at, and JSON payload as parameters', async () => {
    await repo.insert(fakeEvent(99));
    const insertCall = mock.calls.find((c) => c.sql.includes('INSERT INTO'))!;
    expect(insertCall.params[4]).toBe(99); // sequence_number
    expect(insertCall.params[7]).toBe(JSON.stringify({ a: 99 })); // payload
    expect(insertCall.params[9]).toBe('2030-01-01T00:00:00.000Z'); // occurred_at
    expect(insertCall.params[12]).toBeNull(); // tsa_token
  });
});
