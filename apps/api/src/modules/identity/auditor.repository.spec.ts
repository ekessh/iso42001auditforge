// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DrizzleAuditorRepository } from './auditor.repository.js';
import type { LedgerSink } from '../../common/auth.guard.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeLedger(): LedgerSink {
  return { emitAuthFailure: vi.fn() };
}

/** Minimal DB row shape returned by Drizzle select on the auditors table. */
function makeAuditorRow(overrides: Partial<{
  id: string;
  firmId: string;
  email: string;
  fullName: string;
  primaryRole: string;
  employmentStatus: string;
  timezone: string;
  bio: string | null;
  isActive: boolean;
  webauthnEnabled: boolean;
  status: 'active' | 'suspended' | 'disabled';
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
}> = {}) {
  return {
    id: 'aud-1',
    firmId: 'firm-1',
    email: 'alice@example.com',
    fullName: 'Alice Auditor',
    primaryRole: 'lead_auditor',
    employmentStatus: 'employed',
    timezone: 'UTC',
    bio: null,
    isActive: true,
    webauthnEnabled: false,
    status: 'active' as const,
    lockedUntil: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    archivedAt: null,
    ...overrides,
  };
}

function makeCredRow(overrides: Partial<{
  id: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string | null;
  label: string | null;
  firmId: string;
  auditorId: string;
  lastUsedAt: Date | null;
  createdAt: Date;
}> = {}) {
  return {
    id: 'cred-row-1',
    credentialId: 'cred-base64url-abc',
    publicKey: Buffer.from('fake-cose-key').toString('base64'),
    counter: 5,
    transports: 'internal',
    label: null,
    firmId: 'firm-1',
    auditorId: 'aud-1',
    lastUsedAt: null,
    createdAt: new Date('2024-01-01'),
    ...overrides,
  };
}

function makeRoleRow(role = 'lead_auditor') {
  return { role };
}

/**
 * Build a mock Drizzle client whose `.select()` chain returns the specified
 * rows. The chain is: select().from().where().limit() → rows.
 * For join queries: select().from().innerJoin().where().limit() → rows.
 */
function makeDb(rowsByCall: Array<unknown[]>) {
  let callIdx = 0;

  const terminal = () => {
    const rows = rowsByCall[callIdx++] ?? [];
    return Promise.resolve(rows);
  };

  const chain: Record<string, unknown> = {};
  const proxy = new Proxy(chain, {
    get(_target, prop) {
      if (prop === 'then') return undefined; // not a Promise itself
      if (
        prop === 'select' ||
        prop === 'from' ||
        prop === 'where' ||
        prop === 'innerJoin' ||
        prop === 'limit' ||
        prop === 'insert' ||
        prop === 'values' ||
        prop === 'returning' ||
        prop === 'update' ||
        prop === 'set'
      ) {
        if (prop === 'limit' || prop === 'returning') {
          return () => terminal();
        }
        return (..._args: unknown[]) => proxy;
      }
      return undefined;
    },
  });

  return proxy as unknown as import('drizzle-orm/postgres-js').PostgresJsDatabase;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DrizzleAuditorRepository', () => {
  let ledger: LedgerSink;

  beforeEach(() => {
    ledger = makeLedger();
  });

  // ── findByUsername ──────────────────────────────────────────────────────────

  it('returns undefined when no auditor row is found by email', async () => {
    const db = makeDb([[], [], []]); // empty from every query
    const repo = new DrizzleAuditorRepository(db, ledger);
    const result = await repo.findByUsername('ghost@example.com');
    expect(result).toBeUndefined();
  });

  it('returns an AuditorRecord for an active auditor', async () => {
    const auditorRow = makeAuditorRow();
    const roleRows = [makeRoleRow('lead_auditor')];
    const credRows: unknown[] = [];
    const db = makeDb([[auditorRow], roleRows, credRows]);
    const repo = new DrizzleAuditorRepository(db, ledger);
    const result = await repo.findByUsername('alice@example.com');
    expect(result).toBeDefined();
    expect(result?.id).toBe('aud-1');
    expect(result?.firmId).toBe('firm-1');
    expect(result?.status).toBe('active');
    expect(result?.roles).toContain('lead_auditor');
  });

  it('returns undefined and emits ledger event for a suspended auditor', async () => {
    const auditorRow = makeAuditorRow({ status: 'suspended' });
    const db = makeDb([[auditorRow]]);
    const repo = new DrizzleAuditorRepository(db, ledger);
    const result = await repo.findByUsername('alice@example.com');
    expect(result).toBeUndefined();
    expect(ledger.emitAuthFailure).toHaveBeenCalledWith('account_suspended', expect.objectContaining({
      auditorId: 'aud-1',
    }));
  });

  it('returns undefined and emits ledger event for a disabled auditor', async () => {
    const auditorRow = makeAuditorRow({ status: 'disabled' });
    const db = makeDb([[auditorRow]]);
    const repo = new DrizzleAuditorRepository(db, ledger);
    const result = await repo.findByUsername('alice@example.com');
    expect(result).toBeUndefined();
    expect(ledger.emitAuthFailure).toHaveBeenCalledWith('account_disabled', expect.objectContaining({
      auditorId: 'aud-1',
    }));
  });

  it('returns undefined and emits ledger event for a locked (rate-limited) auditor', async () => {
    const lockedUntil = new Date(Date.now() + 10 * 60 * 1_000); // 10 minutes from now
    const auditorRow = makeAuditorRow({ lockedUntil });
    const db = makeDb([[auditorRow]]);
    const repo = new DrizzleAuditorRepository(db, ledger);
    const result = await repo.findByUsername('alice@example.com');
    expect(result).toBeUndefined();
    expect(ledger.emitAuthFailure).toHaveBeenCalledWith('account_locked', expect.objectContaining({
      auditorId: 'aud-1',
    }));
  });

  it('returns the auditor for a lock that has already expired', async () => {
    const expiredLock = new Date(Date.now() - 1_000); // 1 second in the past
    const auditorRow = makeAuditorRow({ lockedUntil: expiredLock });
    const roleRows = [makeRoleRow('lead_auditor')];
    const credRows: unknown[] = [];
    const db = makeDb([[auditorRow], roleRows, credRows]);
    const repo = new DrizzleAuditorRepository(db, ledger);
    const result = await repo.findByUsername('alice@example.com');
    expect(result).toBeDefined();
    expect(result?.status).toBe('active');
    expect(ledger.emitAuthFailure).not.toHaveBeenCalled();
  });

  // ── findByOidcSub ───────────────────────────────────────────────────────────

  it('returns undefined when no OIDC identity mapping exists', async () => {
    const db = makeDb([[]]); // no join result
    const repo = new DrizzleAuditorRepository(db, ledger);
    const result = await repo.findByOidcSub('sub-from-idp');
    expect(result).toBeUndefined();
  });

  it('returns an AuditorRecord when an OIDC identity mapping exists', async () => {
    const auditorRow = makeAuditorRow();
    // Join result shape: { auditor: row, identity: row }
    const joinRows = [{ auditor: auditorRow, identity: { issuer: 'https://idp.example.com', subject: 'sub-123' } }];
    const roleRows = [makeRoleRow('lead_auditor')];
    const credRows: unknown[] = [];
    const db = makeDb([joinRows, roleRows, credRows]);
    const repo = new DrizzleAuditorRepository(db, ledger);
    const result = await repo.findByOidcSub('sub-123');
    expect(result).toBeDefined();
    expect(result?.id).toBe('aud-1');
  });

  // ── findById ────────────────────────────────────────────────────────────────

  it('returns undefined for an unknown ID', async () => {
    const db = makeDb([[]]);
    const repo = new DrizzleAuditorRepository(db, ledger);
    const result = await repo.findById('non-existent-id');
    expect(result).toBeUndefined();
  });

  // ── webauthnCredentials in record ───────────────────────────────────────────

  it('hydrates webauthn credentials from the legacy auditor_webauthn_credentials table', async () => {
    const auditorRow = makeAuditorRow({ webauthnEnabled: true });
    const roleRows = [makeRoleRow('lead_auditor')];
    const credRows = [makeCredRow()];
    const db = makeDb([[auditorRow], roleRows, credRows]);
    const repo = new DrizzleAuditorRepository(db, ledger);
    const result = await repo.findByUsername('alice@example.com');
    expect(result?.webauthnCredentials).toHaveLength(1);
    expect(result?.webauthnCredentials[0]?.credentialId).toBe('cred-base64url-abc');
    expect(result?.webauthnCredentials[0]?.counter).toBe(5);
  });
});
