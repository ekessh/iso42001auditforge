// SPDX-License-Identifier: BUSL-1.1
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { WebAuthnService } from '../src/webauthn.js';

const svc = new WebAuthnService({
  rpName: 'AuditForge Test',
  rpId: 'auditforge.test',
  origin: 'https://auditforge.test',
});

describe('webauthn', () => {
  it('beginRegistration returns options with required fields', async () => {
    const opts = await svc.beginRegistration({
      userId: new Uint8Array(randomBytes(16)),
      userName: 'auditor@example.com',
      userDisplayName: 'Lead Auditor',
    });
    expect(opts.rp.name).toBe('AuditForge Test');
    expect(opts.rp.id).toBe('auditforge.test');
    expect(opts.user.name).toBe('auditor@example.com');
    expect(opts.challenge).toBeDefined();
    expect(opts.authenticatorSelection?.userVerification).toBe('required');
    expect(opts.attestation).toBe('none');
  });

  it('beginRegistration carries excludeCredentials list', async () => {
    const opts = await svc.beginRegistration({
      userId: new Uint8Array(randomBytes(16)),
      userName: 'a@b.com',
      userDisplayName: 'A',
      excludeCredentialIds: ['cred-a', 'cred-b'],
    });
    expect(opts.excludeCredentials).toHaveLength(2);
    expect(opts.excludeCredentials?.[0]?.id).toBe('cred-a');
  });

  it('beginAuthentication returns request options', async () => {
    const opts = await svc.beginAuthentication([]);
    expect(opts.rpId).toBe('auditforge.test');
    expect(opts.userVerification).toBe('required');
    expect(opts.challenge).toBeDefined();
  });

  it('beginAuthentication includes allowCredentials when provided', async () => {
    const opts = await svc.beginAuthentication([
      { credentialId: 'abc', publicKey: new Uint8Array([1, 2, 3]), counter: 5 },
    ]);
    expect(opts.allowCredentials).toHaveLength(1);
    expect(opts.allowCredentials?.[0]?.id).toBe('abc');
  });

  it('reuses configuration across calls', async () => {
    const a = await svc.beginAuthentication([]);
    const b = await svc.beginAuthentication([]);
    expect(a.rpId).toBe(b.rpId);
    expect(a.challenge).not.toBe(b.challenge);
  });
});
