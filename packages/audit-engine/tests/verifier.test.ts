// SPDX-License-Identifier: BUSL-1.1
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  AuditLedger,
  ChainVerifier,
  InMemoryEventRepository,
  StubTsaProvider,
  createDefaultRegistry,
  type EventSigner,
  type SignatureVerifier,
} from '../src/index.js';

const FIRM = '11111111-1111-1111-1111-111111111111';

function newLedger(opts: { signer?: EventSigner } = {}) {
  const repo = new InMemoryEventRepository();
  const ledger = new AuditLedger(repo, createDefaultRegistry(), new StubTsaProvider(), opts.signer);
  return { repo, ledger };
}

describe('ChainVerifier (basic)', () => {
  it('verifies a clean chain via the verifier class', async () => {
    const { repo, ledger } = newLedger();
    await ledger.emit({ firmId: FIRM, producer: 'p' }, 'firm.created', { firmId: FIRM, name: 'A' });
    await ledger.emit({ firmId: FIRM, producer: 'p' }, 'auditor.invited', {
      auditorId: randomUUID(),
      email: 'a@example.com',
    });
    const v = new ChainVerifier(repo);
    const r = await v.verify({ firmId: FIRM });
    expect(r.valid).toBe(true);
    expect(r.checkedCount).toBe(2);
  });

  it('returns first divergence row id on tampering', async () => {
    const { repo, ledger } = newLedger();
    await ledger.emit({ firmId: FIRM, producer: 'p' }, 'firm.created', { firmId: FIRM, name: 'A' });
    await ledger.emit({ firmId: FIRM, producer: 'p' }, 'auditor.invited', {
      auditorId: randomUUID(),
      email: 'a@example.com',
    });
    repo.unsafeMutateForTamperTest(0, (e) => ({ ...e, payload: Object.freeze({ ...e.payload, name: 'X' }) }));
    const v = new ChainVerifier(repo);
    const r = await v.verify({ firmId: FIRM });
    expect(r.valid).toBe(false);
    expect(r.firstInvalidSequence).toBe(1);
  });
});

describe('ChainVerifier with signature verification', () => {
  it('flags a chain whose signature has been swapped', async () => {
    let invocation = 0;
    const signer: EventSigner = {
      async sign(envelope) {
        invocation += 1;
        return {
          signatureBase64: Buffer.from(`sig-${invocation}-${envelope.byteLength}`).toString('base64'),
          keyId: 'k1',
          publicKeyBase64: Buffer.alloc(44).toString('base64'),
        };
      },
    };
    const verifier: SignatureVerifier = {
      async verify(_env, sigBase64, _pub) {
        return Buffer.from(sigBase64, 'base64').toString('utf-8').startsWith('sig-');
      },
    };
    const { repo, ledger } = newLedger({ signer });
    await ledger.emit({ firmId: FIRM, producer: 'p' }, 'firm.created', { firmId: FIRM, name: 'A' }, { sign: true });
    const v = new ChainVerifier(repo, { signatureVerifier: verifier });
    const ok = await v.verify({ firmId: FIRM }, { verifySignatures: true });
    expect(ok.valid).toBe(true);

    repo.unsafeMutateForTamperTest(0, (e) => ({
      ...e,
      signature: Buffer.from('forged').toString('base64'),
    }));
    const fail = await v.verify({ firmId: FIRM }, { verifySignatures: true });
    expect(fail.valid).toBe(false);
    expect(fail.reason).toMatch(/signature/);
  });
});

describe('ChainVerifier — property-based clean chains always verify', () => {
  it('arbitrary clean event sequences verify true', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({ name: fc.string({ minLength: 1, maxLength: 8 }) }),
          { minLength: 1, maxLength: 12 },
        ),
        async (records) => {
          const { repo, ledger } = newLedger();
          for (const r of records) {
            await ledger.emit({ firmId: FIRM, producer: 'p' }, 'firm.created', {
              firmId: FIRM,
              name: r.name,
            });
          }
          const v = new ChainVerifier(repo);
          const out = await v.verify({ firmId: FIRM });
          return out.valid && out.checkedCount === records.length;
        },
      ),
      { numRuns: 25 },
    );
  });

  it('arbitrary single tampered chains always fail with correct first divergence', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(
          fc.array(fc.string({ minLength: 1, maxLength: 6 }), { minLength: 2, maxLength: 8 }),
          fc.integer({ min: 0, max: 7 }),
        ),
        async ([names, idxRaw]) => {
          const { repo, ledger } = newLedger();
          for (const n of names) {
            await ledger.emit({ firmId: FIRM, producer: 'p' }, 'firm.created', { firmId: FIRM, name: n });
          }
          const idx = idxRaw % names.length;
          repo.unsafeMutateForTamperTest(idx, (e) => ({
            ...e,
            payload: Object.freeze({ ...e.payload, name: 'TAMPERED' }),
          }));
          const v = new ChainVerifier(repo);
          const r = await v.verify({ firmId: FIRM });
          if (r.valid) return false;
          if (r.firstInvalidSequence === undefined) return false;
          return r.firstInvalidSequence === idx + 1 || r.firstInvalidSequence === idx + 2;
        },
      ),
      { numRuns: 20 },
    );
  });
});
