// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect, beforeEach } from 'vitest';
import { IdentityService } from './identity.service.js';
import type { AppConfig } from '../../config/config.schema.js';

const cfg = {
  OIDC_ISSUER: 'https://idp.example.com',
  OIDC_CLIENT_ID: 'cid',
  WEBAUTHN_RP_ID: 'localhost',
  WEBAUTHN_RP_NAME: 'AuditForge',
  WEBAUTHN_ORIGIN: 'http://localhost:3000',
} as unknown as AppConfig;

describe('IdentityService', () => {
  let svc: IdentityService;
  beforeEach(() => { svc = new IdentityService(cfg); });

  it('starts OIDC flow', async () => {
    const r = await svc.oidcStart('google');
    expect(r.authorizeUrl).toContain('https://idp.example.com');
    expect(r.state).toHaveLength(32);
  });

  it('webauthn register start issues challenge', async () => {
    const r = await svc.webauthnRegisterStart('alice');
    expect(r.challenge.length).toBeGreaterThan(0);
    expect(r.rpId).toBe('localhost');
  });

  it('webauthn register/login round-trip yields session', async () => {
    await svc.webauthnRegisterStart('bob');
    const sess = await svc.webauthnRegisterFinish('bob', { stub: true });
    expect(sess.firmId).toBe('demo-firm');
    await svc.webauthnLoginStart('bob');
    const s2 = await svc.webauthnLoginFinish('bob', { stub: true });
    expect(s2.auditorId).toBe(sess.auditorId);
  });

  it('rejects login finish without start', async () => {
    await expect(svc.webauthnLoginFinish('ghost', {})).rejects.toThrow();
  });
});
