// SPDX-License-Identifier: BUSL-1.1
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AuthenticationError } from '@auditforge/shared';
import {
  InMemoryReplayStore,
  rotateSessionToken,
  signSessionToken,
  verifySessionToken,
} from '../src/jwt.js';

const secret = new Uint8Array(randomBytes(32));
const issuer = 'urn:auditforge:test';
const audience = 'urn:auditforge:api';

describe('jwt', () => {
  it('signs and verifies a session token', async () => {
    const token = await signSessionToken(secret, {
      issuer,
      audience,
      subject: 'auditor-1',
      expiresInSeconds: 60,
      jwtId: 'jti-1',
      additionalClaims: { role: 'lead_auditor' },
    });
    const v = await verifySessionToken(secret, token, { issuer, audience });
    expect(v.sub).toBe('auditor-1');
    expect(v.jti).toBe('jti-1');
    expect(v.payload.role).toBe('lead_auditor');
  });

  it('rejects tokens signed with a different secret', async () => {
    const otherSecret = new Uint8Array(randomBytes(32));
    const token = await signSessionToken(otherSecret, {
      issuer,
      audience,
      subject: 'auditor-1',
      expiresInSeconds: 60,
      jwtId: 'jti-bad',
    });
    await expect(
      verifySessionToken(secret, token, { issuer, audience }),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('rejects tokens with wrong issuer', async () => {
    const token = await signSessionToken(secret, {
      issuer: 'urn:other',
      audience,
      subject: 'a',
      expiresInSeconds: 60,
      jwtId: 'j',
    });
    await expect(
      verifySessionToken(secret, token, { issuer, audience }),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('rejects expired tokens', async () => {
    const token = await signSessionToken(secret, {
      issuer,
      audience,
      subject: 'a',
      expiresInSeconds: -10,
      jwtId: 'j-exp',
    });
    await expect(
      verifySessionToken(secret, token, { issuer, audience }),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('rejects replay attempts', async () => {
    const replay = new InMemoryReplayStore();
    const token = await signSessionToken(secret, {
      issuer,
      audience,
      subject: 'a',
      expiresInSeconds: 60,
      jwtId: 'replay-jti',
    });
    await verifySessionToken(secret, token, { issuer, audience }, replay);
    await expect(
      verifySessionToken(secret, token, { issuer, audience }, replay),
    ).rejects.toThrow(/replay/);
  });

  it('rotateSessionToken revokes prior and issues fresh', async () => {
    const revoked: string[] = [];
    const fresh = await rotateSessionToken(
      secret,
      {
        issuer,
        audience,
        subject: 'a',
        expiresInSeconds: 60,
        jwtId: 'new-jti',
      },
      'old-jti',
      {
        onRevoke: (jti) => {
          revoked.push(jti);
        },
        onSign: () => {},
      },
    );
    expect(revoked).toEqual(['old-jti']);
    const v = await verifySessionToken(secret, fresh, { issuer, audience });
    expect(v.jti).toBe('new-jti');
  });

  it('replay store eviction after expiry', async () => {
    const replay = new InMemoryReplayStore();
    await replay.remember('x', Math.floor(Date.now() / 1000) - 5);
    expect(await replay.has('x')).toBe(false);
  });
});
