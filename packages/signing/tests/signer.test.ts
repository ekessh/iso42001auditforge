// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { SigningService, SoftwareSigningProvider, canonicalizeToBytes } from '../src/index.js';

function newService() {
  const { provider, privateKeyBase64 } = SoftwareSigningProvider.generate('test-key-1');
  return { service: new SigningService(provider), privateKeyBase64 };
}

describe('SoftwareSigningProvider', () => {
  it('generates and round-trips a key', async () => {
    const { provider } = SoftwareSigningProvider.generate('k1');
    const desc = await provider.describe();
    expect(desc.algorithm).toBe('Ed25519');
    expect(desc.keyId).toBe('k1');
    expect(desc.hardwareBacked).toBe(false);
  });

  it('refuses non-48-byte private key', () => {
    expect(() =>
      new SoftwareSigningProvider({ privateKeyBase64: Buffer.alloc(10).toString('base64'), keyId: 'x' }),
    ).toThrow();
  });

  it('signs and verifies a payload', async () => {
    const { provider } = SoftwareSigningProvider.generate('k');
    const payload = new TextEncoder().encode('hello');
    const sig = await provider.sign(payload);
    expect(await provider.verify(payload, sig)).toBe(true);
  });

  it('rejects altered payload', async () => {
    const { provider } = SoftwareSigningProvider.generate('k');
    const payload = new TextEncoder().encode('hello');
    const sig = await provider.sign(payload);
    expect(await provider.verify(new TextEncoder().encode('hellO'), sig)).toBe(false);
  });
});

describe('SigningService receipts', () => {
  it('produces a verifiable receipt for a JSON value', async () => {
    const { service } = newService();
    const r = await service.signCanonicalJson({ x: 1, y: 'two' }, { signerId: 'auditor-1' });
    expect(r.algorithm).toBe('Ed25519');
    expect(r.signerId).toBe('auditor-1');
    expect(r.payloadHash).toMatch(/^[0-9a-f]{64}$/);
    const ok = await service.verifyReceipt(canonicalizeToBytes({ x: 1, y: 'two' }), r);
    expect(ok).toBe(true);
  });

  it('detects payload tampering', async () => {
    const { service } = newService();
    const r = await service.signCanonicalJson({ x: 1 }, { signerId: 's' });
    const ok = await service.verifyReceipt(canonicalizeToBytes({ x: 2 }), r);
    expect(ok).toBe(false);
  });

  it('honors prevHash chaining input', async () => {
    const { service } = newService();
    const r = await service.signCanonicalJson({ a: 1 }, { signerId: 's', prevHash: 'a'.repeat(64) });
    expect(r.prevHash).toBe('a'.repeat(64));
  });

  it('property: any JSON value round-trips through sign/verify', async () => {
    const { service } = newService();
    await fc.assert(
      fc.asyncProperty(
        fc.jsonValue(),
        async (v) => {
          const r = await service.signCanonicalJson(v, { signerId: 's' });
          const ok = await service.verifyReceipt(canonicalizeToBytes(v), r);
          return ok === true;
        },
      ),
      { numRuns: 25 },
    );
  });
});
