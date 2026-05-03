// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';

import { AuthError, JwksAuthGateway, StaticPrincipalAuthGateway } from '../src/auth.js';
import type { ExpectedClaims } from '../src/auth.js';

function makeClaims(overrides: Partial<ExpectedClaims> = {}): ExpectedClaims {
  return {
    sub: 'auth0|user-1',
    aud: 'https://mcp.auditforge',
    iss: 'https://idp.auditforge',
    exp: Math.floor(Date.now() / 1000) + 600,
    nbf: Math.floor(Date.now() / 1000) - 30,
    jti: 'jti-1',
    auditforge_firm_id: 'firm-1',
    auditforge_auditor_id: 'auditor-1',
    auditforge_roles: ['lead_auditor'],
    auditforge_engagements: ['eng-1'],
    ...overrides,
  };
}

describe('auth (oauth-mocked)', () => {
  it('verifies a well-formed bearer and returns the principal', async () => {
    const gw = new JwksAuthGateway({
      verifyJwt: async (t) => {
        if (t !== 'good') throw new Error('bad');
        return makeClaims();
      },
      expectedAudience: 'https://mcp.auditforge',
      expectedIssuer: 'https://idp.auditforge',
    });
    const p = await gw.verify('Bearer good');
    expect(p.firmId).toBe('firm-1');
    expect(p.roles).toEqual(['lead_auditor']);
    expect(p.engagements).toEqual(['eng-1']);
  });

  it('rejects a missing authorization header', async () => {
    const gw = new JwksAuthGateway({
      verifyJwt: async () => makeClaims(),
      expectedAudience: 'a', expectedIssuer: 'i',
    });
    await expect(gw.verify(null)).rejects.toBeInstanceOf(AuthError);
    await expect(gw.verify('')).rejects.toBeInstanceOf(AuthError);
  });

  it('rejects malformed authorization header', async () => {
    const gw = new JwksAuthGateway({
      verifyJwt: async () => makeClaims(),
      expectedAudience: 'a', expectedIssuer: 'i',
    });
    await expect(gw.verify('Bear nope')).rejects.toThrow(/malformed/);
  });

  it('rejects on issuer mismatch', async () => {
    const gw = new JwksAuthGateway({
      verifyJwt: async () => makeClaims({ iss: 'https://attacker.example' }),
      expectedAudience: 'https://mcp.auditforge',
      expectedIssuer: 'https://idp.auditforge',
    });
    await expect(gw.verify('Bearer x')).rejects.toThrow(/issuer/);
  });

  it('rejects on audience mismatch', async () => {
    const gw = new JwksAuthGateway({
      verifyJwt: async () => makeClaims({ aud: 'https://other.audience' }),
      expectedAudience: 'https://mcp.auditforge',
      expectedIssuer: 'https://idp.auditforge',
    });
    await expect(gw.verify('Bearer x')).rejects.toThrow(/aud/);
  });

  it('rejects expired tokens (with skew)', async () => {
    const past = Math.floor(Date.now() / 1000) - 300;
    const gw = new JwksAuthGateway({
      verifyJwt: async () => makeClaims({ exp: past }),
      expectedAudience: 'https://mcp.auditforge',
      expectedIssuer: 'https://idp.auditforge',
    });
    await expect(gw.verify('Bearer x')).rejects.toThrow(/expired/);
  });

  it('rejects when no audit roles are present', async () => {
    const gw = new JwksAuthGateway({
      verifyJwt: async () => makeClaims({ auditforge_roles: ['random_role'] }),
      expectedAudience: 'https://mcp.auditforge',
      expectedIssuer: 'https://idp.auditforge',
    });
    await expect(gw.verify('Bearer x')).rejects.toThrow(/no audit roles/);
  });

  it('rejects on bad signature (verifyJwt throws)', async () => {
    const gw = new JwksAuthGateway({
      verifyJwt: async () => {
        throw new Error('bad sig');
      },
      expectedAudience: 'a',
      expectedIssuer: 'i',
    });
    await expect(gw.verify('Bearer x')).rejects.toThrow(/token verification failed/);
  });

  it('StaticPrincipalAuthGateway requires _testOnly: true', () => {
    expect(
      () =>
        new StaticPrincipalAuthGateway([], { _testOnly: false as unknown as true }),
    ).toThrow();
  });

  it('StaticPrincipalAuthGateway rejects unknown tokens', async () => {
    const gw = new StaticPrincipalAuthGateway([], { _testOnly: true });
    await expect(gw.verify('Bearer nope')).rejects.toThrow(/unknown test token/);
  });
});
