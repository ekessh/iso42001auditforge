// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DrizzleWebAuthnCredentialRepository,
  MonotonicityViolationError,
} from './webauthn-credential.repository.js';
import type { LedgerSink } from './auth.guard.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeLedger(): LedgerSink {
  return { emitAuthFailure: vi.fn() };
}

const FAKE_PUBLIC_KEY = new Uint8Array([1, 2, 3, 4, 5]);

function makeCredRow(overrides: Partial<{
  id: string;
  firmId: string;
  auditorId: string;
  credentialId: string;
  publicKey: Buffer | Uint8Array;
  counter: number;
  transports: string[] | null;
  aaguid: string | null;
  userVerified: boolean;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}> = {}) {
  return {
    id: 'wc-row-1',
    firmId: 'firm-1',
    auditorId: 'aud-1',
    credentialId: 'cred-abc123',
    publicKey: Buffer.from(FAKE_PUBLIC_KEY),
    counter: 10,
    transports: ['internal'],
    aaguid: null,
    userVerified: true,
    createdAt: new Date('2024-01-01'),
    lastUsedAt: null,
    revokedAt: null,
    ...overrides,
  };
}

/**
 * Build a mock Drizzle client where each chain-terminated call (limit / set)
 * returns the next item from rowsByCall.
 */
function makeDb(rowsByCall: Array<unknown[] | { rowCount?: number }>) {
  let callIdx = 0;

  const consumeRows = () => {
    const result = rowsByCall[callIdx++] ?? [];
    return result;
  };

  function makeQueryProxy(): object {
    let resolvedRows: unknown[] | undefined;

    const resolve = () => {
      if (resolvedRows === undefined) resolvedRows = consumeRows() as unknown[];
      return resolvedRows;
    };

    const handler: ProxyHandler<object> = {
      get(_target, prop) {
        if (prop === 'then') {
          return (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
            Promise.resolve(resolve()).then(onFulfilled, onRejected);
        }
        if (prop === 'limit' || prop === 'returning') {
          return () => Promise.resolve(resolve());
        }
        if (prop === 'from' || prop === 'where' || prop === 'innerJoin') {
          return (..._args: unknown[]) => proxy; // eslint-disable-line @typescript-eslint/no-use-before-define
        }
        return undefined;
      },
    };
    const proxy = new Proxy({}, handler);
    return proxy;
  }

  // update().set() chain: set().where() resolves rows (typically a rowCount-like result).
  function makeUpdateProxy(): object {
    const handler: ProxyHandler<object> = {
      get(_target, prop) {
        if (prop === 'set') {
          return () => makeQueryProxy();
        }
        return undefined;
      },
    };
    return new Proxy({}, handler);
  }

  const dbHandler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === 'select') return () => makeQueryProxy();
      if (prop === 'update') return () => makeUpdateProxy();
      if (prop === 'insert') return () => ({ values: () => makeQueryProxy() });
      return undefined;
    },
  };

  return new Proxy({}, dbHandler) as unknown as import('drizzle-orm/postgres-js').PostgresJsDatabase;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DrizzleWebAuthnCredentialRepository', () => {
  let ledger: LedgerSink;

  beforeEach(() => {
    ledger = makeLedger();
  });

  // ── getByCredentialId ───────────────────────────────────────────────────────

  it('returns null when credential is not found', async () => {
    const db = makeDb([[]]); // empty result
    const repo = new DrizzleWebAuthnCredentialRepository(db, ledger);
    const result = await repo.getByCredentialId('non-existent');
    expect(result).toBeNull();
  });

  it('returns a CredentialRecord for a valid active credential', async () => {
    const row = makeCredRow();
    const db = makeDb([[row]]);
    const repo = new DrizzleWebAuthnCredentialRepository(db, ledger);
    const result = await repo.getByCredentialId('cred-abc123');
    expect(result).not.toBeNull();
    expect(result?.credentialId).toBe('cred-abc123');
    expect(result?.counter).toBe(10);
    expect(result?.auditorId).toBe('aud-1');
    expect(result?.firmId).toBe('firm-1');
    expect(result?.userVerified).toBe(true);
    expect(result?.publicKey).toBeInstanceOf(Uint8Array);
  });

  it('excludes revoked credentials (returns null)', async () => {
    // The WHERE clause filters out rows with revokedAt IS NOT NULL.
    // Our mock returns empty to simulate that filter.
    const db = makeDb([[]]);
    const repo = new DrizzleWebAuthnCredentialRepository(db, ledger);
    const result = await repo.getByCredentialId('revoked-cred');
    expect(result).toBeNull();
  });

  // ── incrementCounter ────────────────────────────────────────────────────────

  it('succeeds when newCounter is strictly greater than stored counter', async () => {
    const currentRow = { counter: 10, revokedAt: null };
    // First call: select to read current counter. Second call: update.
    const db = makeDb([[currentRow], {}]);
    const repo = new DrizzleWebAuthnCredentialRepository(db, ledger);
    await expect(repo.incrementCounter('cred-abc123', 11)).resolves.toBeUndefined();
  });

  it('throws MonotonicityViolationError when newCounter equals stored counter', async () => {
    const currentRow = { counter: 10, revokedAt: null };
    const db = makeDb([[currentRow]]);
    const repo = new DrizzleWebAuthnCredentialRepository(db, ledger);
    await expect(repo.incrementCounter('cred-abc123', 10)).rejects.toBeInstanceOf(
      MonotonicityViolationError,
    );
    expect(ledger.emitAuthFailure).toHaveBeenCalledWith(
      'webauthn_counter_monotonicity_violation',
      expect.objectContaining({ credentialId: 'cred-abc123' }),
    );
  });

  it('throws MonotonicityViolationError when newCounter is less than stored counter (replay)', async () => {
    const currentRow = { counter: 10, revokedAt: null };
    const db = makeDb([[currentRow]]);
    const repo = new DrizzleWebAuthnCredentialRepository(db, ledger);
    await expect(repo.incrementCounter('cred-abc123', 5)).rejects.toBeInstanceOf(
      MonotonicityViolationError,
    );
  });

  it('captures stored and received counter values in MonotonicityViolationError', async () => {
    const currentRow = { counter: 42, revokedAt: null };
    const db = makeDb([[currentRow]]);
    const repo = new DrizzleWebAuthnCredentialRepository(db, ledger);
    let caughtError: MonotonicityViolationError | undefined;
    try {
      await repo.incrementCounter('cred-abc123', 7);
    } catch (e) {
      if (e instanceof MonotonicityViolationError) caughtError = e;
    }
    expect(caughtError?.storedCounter).toBe(42);
    expect(caughtError?.receivedCounter).toBe(7);
  });

  it('throws when credential is not found', async () => {
    const db = makeDb([[]]); // no row returned
    const repo = new DrizzleWebAuthnCredentialRepository(db, ledger);
    await expect(repo.incrementCounter('non-existent', 1)).rejects.toThrow('Credential not found');
  });

  it('throws when credential is already revoked', async () => {
    const currentRow = { counter: 10, revokedAt: new Date() };
    const db = makeDb([[currentRow]]);
    const repo = new DrizzleWebAuthnCredentialRepository(db, ledger);
    await expect(repo.incrementCounter('cred-abc123', 11)).rejects.toThrow('revoked');
  });

  // ── revoke ──────────────────────────────────────────────────────────────────

  it('soft-deletes a credential and emits ledger event', async () => {
    const credMeta = [{ id: 'wc-row-1', auditorId: 'aud-1', firmId: 'firm-1' }];
    // First call: select to get credential metadata. Second call: update set revokedAt.
    const db = makeDb([credMeta, {}]);
    const repo = new DrizzleWebAuthnCredentialRepository(db, ledger);
    await repo.revoke('cred-abc123', 'security_policy');
    expect(ledger.emitAuthFailure).toHaveBeenCalledWith(
      'webauthn_credential_revoked',
      expect.objectContaining({ credentialId: 'cred-abc123', reason: 'security_policy' }),
    );
  });

  it('is a no-op (no error) when credential does not exist', async () => {
    const db = makeDb([[]]); // no row
    const repo = new DrizzleWebAuthnCredentialRepository(db, ledger);
    await expect(repo.revoke('non-existent', 'test')).resolves.toBeUndefined();
  });

  // ── listForAuditor ──────────────────────────────────────────────────────────

  it('returns an empty array when the auditor has no credentials', async () => {
    const db = makeDb([[]]); // the SELECT with isNull(revokedAt) returns nothing
    const repo = new DrizzleWebAuthnCredentialRepository(db, ledger);
    const results = await repo.listForAuditor('firm-1', 'aud-1');
    expect(results).toEqual([]);
  });

  it('returns only non-revoked credentials for an auditor', async () => {
    const rows = [makeCredRow({ credentialId: 'cred-1' }), makeCredRow({ credentialId: 'cred-2' })];
    const db = makeDb([rows]);
    const repo = new DrizzleWebAuthnCredentialRepository(db, ledger);
    const results = await repo.listForAuditor('firm-1', 'aud-1');
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.credentialId)).toEqual(['cred-1', 'cred-2']);
  });
});
