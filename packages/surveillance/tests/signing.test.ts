// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import {
  InMemoryNonceStore,
  signRequest,
  verifyRequest,
} from '../src/signing.js';
import { AuthenticationError, ValidationError } from '@auditforge/shared';

const SECRET = 'a-strong-secret-for-tests-XXXXX';
const TENANT = 't1';

function freshHeaders(overrides: Partial<{ ts: number; nonce: string; tenant: string }> = {}) {
  const tenantId = overrides.tenant ?? TENANT;
  const timestamp = overrides.ts ?? Math.floor(Date.now() / 1000);
  const nonce = overrides.nonce ?? `nonce_${Math.random().toString(36).slice(2, 12)}`;
  const body = '{"hello":"world"}';
  const signature = signRequest({
    tenantId,
    streamId: 's1',
    timestamp,
    nonce,
    body,
    secret: SECRET,
  });
  return { headers: { tenantId, streamId: 's1', timestamp, nonce, signature }, body };
}

describe('signing.signRequest', () => {
  it('produces a 64-char hex signature', () => {
    const sig = signRequest({
      tenantId: TENANT,
      streamId: 's1',
      timestamp: 1_700_000_000,
      nonce: 'n12345678',
      body: 'x',
      secret: SECRET,
    });
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects short secrets', () => {
    expect(() =>
      signRequest({
        tenantId: TENANT,
        streamId: 's1',
        timestamp: 1,
        nonce: 'nonce123',
        body: '',
        secret: 'short',
      }),
    ).toThrow(ValidationError);
  });

  it('rejects out-of-range nonces', () => {
    expect(() =>
      signRequest({
        tenantId: TENANT,
        streamId: 's1',
        timestamp: 1,
        nonce: 'n',
        body: '',
        secret: SECRET,
      }),
    ).toThrow(ValidationError);
  });
});

describe('signing.verifyRequest — happy path', () => {
  it('accepts a fresh, well-signed request', () => {
    const store = new InMemoryNonceStore();
    const { headers, body } = freshHeaders();
    expect(() =>
      verifyRequest(headers, body, {
        secret: SECRET,
        replayWindowSeconds: 300,
        expectedTenantId: TENANT,
        nonceStore: store,
      }),
    ).not.toThrow();
  });
});

describe('signing.verifyRequest — replay protection', () => {
  it('rejects nonce reuse within window', () => {
    const store = new InMemoryNonceStore();
    const { headers, body } = freshHeaders();
    verifyRequest(headers, body, {
      secret: SECRET,
      replayWindowSeconds: 300,
      expectedTenantId: TENANT,
      nonceStore: store,
    });
    expect(() =>
      verifyRequest(headers, body, {
        secret: SECRET,
        replayWindowSeconds: 300,
        expectedTenantId: TENANT,
        nonceStore: store,
      }),
    ).toThrow(/replay/i);
  });

  it('rejects timestamp outside window', () => {
    const store = new InMemoryNonceStore();
    const now = Math.floor(Date.now() / 1000);
    const { headers, body } = freshHeaders({ ts: now - 10_000 });
    expect(() =>
      verifyRequest(headers, body, {
        secret: SECRET,
        replayWindowSeconds: 300,
        expectedTenantId: TENANT,
        nonceStore: store,
      }),
    ).toThrow(/replay window/);
  });
});

describe('signing.verifyRequest — tampering', () => {
  it('rejects body tampering', () => {
    const store = new InMemoryNonceStore();
    const { headers } = freshHeaders();
    expect(() =>
      verifyRequest(headers, '{"hello":"WORLD"}', {
        secret: SECRET,
        replayWindowSeconds: 300,
        expectedTenantId: TENANT,
        nonceStore: store,
      }),
    ).toThrow(/signature mismatch/);
  });

  it('rejects wrong tenant', () => {
    const store = new InMemoryNonceStore();
    const { headers, body } = freshHeaders();
    expect(() =>
      verifyRequest(headers, body, {
        secret: SECRET,
        replayWindowSeconds: 300,
        expectedTenantId: 'someone-else',
        nonceStore: store,
      }),
    ).toThrow(/tenant mismatch/);
  });

  it('rejects malformed signature', () => {
    const store = new InMemoryNonceStore();
    const { headers, body } = freshHeaders();
    const tampered = { ...headers, signature: 'zzzz' };
    expect(() =>
      verifyRequest(tampered, body, {
        secret: SECRET,
        replayWindowSeconds: 300,
        expectedTenantId: TENANT,
        nonceStore: store,
      }),
    ).toThrow(AuthenticationError);
  });

  it('rejects non-integer timestamp', () => {
    const store = new InMemoryNonceStore();
    const { headers, body } = freshHeaders();
    const t = { ...headers, timestamp: 1.5 };
    expect(() =>
      verifyRequest(t, body, {
        secret: SECRET,
        replayWindowSeconds: 300,
        expectedTenantId: TENANT,
        nonceStore: store,
      }),
    ).toThrow(/integer/);
  });
});

describe('signing.InMemoryNonceStore', () => {
  it('prunes expired entries', () => {
    const store = new InMemoryNonceStore();
    store.putIfAbsent('t1', 'n1', Math.floor(Date.now() / 1000) - 10);
    store.putIfAbsent('t1', 'n2', Math.floor(Date.now() / 1000) + 1000);
    store.prune(Math.floor(Date.now() / 1000));
    expect(store.size()).toBe(1);
  });
});
