// SPDX-License-Identifier: BUSL-1.1
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  AuditLedger,
  GENESIS_HASH,
  InMemoryEventRepository,
  StubTsaProvider,
  createDefaultRegistry,
} from '../src/index.js';

const FIRM_A = '11111111-1111-1111-1111-111111111111';
const FIRM_B = '22222222-2222-2222-2222-222222222222';
const AUDITOR = '33333333-3333-3333-3333-333333333333';

function newLedger() {
  const repo = new InMemoryEventRepository();
  const ledger = new AuditLedger(repo, createDefaultRegistry(), new StubTsaProvider());
  return { repo, ledger };
}

describe('AuditLedger', () => {
  it('emits an event with sequence 1 chained from genesis', async () => {
    const { ledger } = newLedger();
    const evt = await ledger.emit(
      { firmId: FIRM_A, auditorId: AUDITOR, producer: 'test' },
      'firm.created',
      { firmId: FIRM_A, name: 'Acme CB' },
    );
    expect(evt.sequenceNumber).toBe(1);
    expect(evt.prevHash).toBe(GENESIS_HASH);
    expect(evt.chainHash).toMatch(/^[0-9a-f]{64}$/);
    expect(evt.firmId).toBe(FIRM_A);
  });

  it('subsequent events chain prevHash correctly', async () => {
    const { ledger } = newLedger();
    const e1 = await ledger.emit(
      { firmId: FIRM_A, producer: 'p' },
      'firm.created',
      { firmId: FIRM_A, name: 'A' },
    );
    const e2 = await ledger.emit(
      { firmId: FIRM_A, producer: 'p' },
      'auditor.invited',
      { auditorId: AUDITOR, email: 'aud@example.com' },
    );
    expect(e2.sequenceNumber).toBe(2);
    expect(e2.prevHash).toBe(e1.chainHash);
  });

  it('per-firm sequences are independent', async () => {
    const { ledger } = newLedger();
    await ledger.emit({ firmId: FIRM_A, producer: 'p' }, 'firm.created', { firmId: FIRM_A, name: 'A' });
    const b1 = await ledger.emit(
      { firmId: FIRM_B, producer: 'p' },
      'firm.created',
      { firmId: FIRM_B, name: 'B' },
    );
    expect(b1.sequenceNumber).toBe(1);
    expect(b1.prevHash).toBe(GENESIS_HASH);
  });

  it('rejects unknown event types', async () => {
    const { ledger } = newLedger();
    await expect(
      ledger.emit({ firmId: FIRM_A, producer: 'p' }, 'totally.fake', {}),
    ).rejects.toThrow(/Unknown event type/);
  });

  it('rejects payload that fails schema', async () => {
    const { ledger } = newLedger();
    await expect(
      ledger.emit({ firmId: FIRM_A, producer: 'p' }, 'firm.created', { name: 'no firmId' }),
    ).rejects.toThrow(/Invalid event payload/);
  });

  it('verifyChain returns valid for a clean chain', async () => {
    const { ledger } = newLedger();
    await ledger.emit({ firmId: FIRM_A, producer: 'p' }, 'firm.created', { firmId: FIRM_A, name: 'A' });
    await ledger.emit(
      { firmId: FIRM_A, producer: 'p' },
      'auditor.invited',
      { auditorId: AUDITOR, email: 'a@b.c' },
    );
    await ledger.emit(
      { firmId: FIRM_A, producer: 'p' },
      'engagement.created',
      { engagementId: randomUUID(), clientId: randomUUID(), scopeStatement: 'AIMS' },
    );
    const r = await ledger.verifyChain({ firmId: FIRM_A });
    expect(r.valid).toBe(true);
    expect(r.checkedCount).toBe(3);
  });

  it('verifyChain detects payload tampering', async () => {
    const { ledger, repo } = newLedger();
    await ledger.emit({ firmId: FIRM_A, producer: 'p' }, 'firm.created', { firmId: FIRM_A, name: 'A' });
    await ledger.emit(
      { firmId: FIRM_A, producer: 'p' },
      'auditor.invited',
      { auditorId: AUDITOR, email: 'a@b.c' },
    );
    repo.unsafeMutateForTamperTest(0, (e) => ({ ...e, payload: Object.freeze({ ...e.payload, name: 'TAMPERED' }) }));
    const r = await ledger.verifyChain({ firmId: FIRM_A });
    expect(r.valid).toBe(false);
    expect(r.firstInvalidSequence).toBe(1);
  });

  it('verifyChain detects chainHash tampering', async () => {
    const { ledger, repo } = newLedger();
    await ledger.emit({ firmId: FIRM_A, producer: 'p' }, 'firm.created', { firmId: FIRM_A, name: 'A' });
    await ledger.emit(
      { firmId: FIRM_A, producer: 'p' },
      'auditor.invited',
      { auditorId: AUDITOR, email: 'a@b.c' },
    );
    repo.unsafeMutateForTamperTest(1, (e) => ({ ...e, prevHash: 'a'.repeat(64) }));
    const r = await ledger.verifyChain({ firmId: FIRM_A });
    expect(r.valid).toBe(false);
    expect(r.firstInvalidSequence).toBe(2);
    expect(r.reason).toContain('prevHash mismatch');
  });

  it('replay rebuilds projection deterministically', async () => {
    const { ledger } = newLedger();
    const aud = randomUUID();
    await ledger.emit({ firmId: FIRM_A, producer: 'p' }, 'auditor.invited', { auditorId: aud, email: 'x@y.z' });
    await ledger.emit({ firmId: FIRM_A, producer: 'p' }, 'auditor.role_assigned', {
      auditorId: aud,
      role: 'lead_auditor',
    });
    type Audi = { id: string; email?: string; role?: string };
    const projection = await ledger.replay<Map<string, Audi>>(
      { firmId: FIRM_A },
      (state, e) => {
        if (e.eventType === 'auditor.invited') {
          state.set(String(e.payload.auditorId), {
            id: String(e.payload.auditorId),
            email: String(e.payload.email),
          });
        }
        if (e.eventType === 'auditor.role_assigned') {
          const a = state.get(String(e.payload.auditorId));
          if (a) state.set(a.id, { ...a, role: String(e.payload.role) });
        }
        return state;
      },
      new Map(),
    );
    const aDef = projection.get(aud);
    expect(aDef).toBeDefined();
    expect(aDef?.email).toBe('x@y.z');
    expect(aDef?.role).toBe('lead_auditor');
  });

  it('signWithTSA produces a verifiable token (stub)', async () => {
    const { ledger } = newLedger();
    const evt = await ledger.emit(
      { firmId: FIRM_A, producer: 'p' },
      'firm.created',
      { firmId: FIRM_A, name: 'A' },
    );
    const token = await ledger.signWithTSA(evt);
    expect(token.placeholder).toBe(true);
    expect(token.token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('emit with applyTsa attaches a stub token to the event', async () => {
    const { ledger } = newLedger();
    const evt = await ledger.emit(
      { firmId: FIRM_A, producer: 'p' },
      'audit_file.frozen',
      {
        archiveId: randomUUID(),
        engagementId: randomUUID(),
        sha256: 'a'.repeat(64),
      },
      { applyTsa: true },
    );
    expect(evt.tsaToken).not.toBeNull();
    expect(evt.tsaToken?.placeholder).toBe(true);
  });

  it('cross-firm replay does not leak events', async () => {
    const { ledger } = newLedger();
    await ledger.emit({ firmId: FIRM_A, producer: 'p' }, 'firm.created', { firmId: FIRM_A, name: 'A' });
    await ledger.emit({ firmId: FIRM_B, producer: 'p' }, 'firm.created', { firmId: FIRM_B, name: 'B' });
    const seen: string[] = [];
    await ledger.replay({ firmId: FIRM_A }, (acc, e) => {
      seen.push(e.firmId);
      return acc;
    }, null);
    expect(new Set(seen)).toEqual(new Set([FIRM_A]));
  });

  it('listEvents respects engagementId filter', async () => {
    const { ledger } = newLedger();
    const eng1 = randomUUID();
    const eng2 = randomUUID();
    await ledger.emit(
      { firmId: FIRM_A, engagementId: eng1, producer: 'p' },
      'engagement.created',
      { engagementId: eng1, clientId: randomUUID(), scopeStatement: 'A' },
    );
    await ledger.emit(
      { firmId: FIRM_A, engagementId: eng2, producer: 'p' },
      'engagement.created',
      { engagementId: eng2, clientId: randomUUID(), scopeStatement: 'B' },
    );
    const list = await ledger.listEvents({ firmId: FIRM_A, engagementId: eng1 });
    expect(list).toHaveLength(1);
    expect(list[0]?.engagementId).toBe(eng1);
  });

  it('TSA verify round-trip works for stub provider', async () => {
    const tsa = new StubTsaProvider();
    const tok = await tsa.sign('a'.repeat(64));
    expect(await tsa.verify('a'.repeat(64), tok)).toBe(true);
    expect(await tsa.verify('b'.repeat(64), tok)).toBe(false);
  });
});
