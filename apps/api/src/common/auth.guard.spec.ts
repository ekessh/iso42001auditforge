// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { SignJWT, generateKeyPair } from 'jose';
import { AuthGuard } from './auth.guard.js';
import { UnauthorizedError } from './errors.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeCtx(opts: {
  headers?: Record<string, string | undefined>;
  auth?: unknown;
  isPublic?: boolean;
}): ExecutionContext {
  const req = { headers: opts.headers ?? {}, auth: opts.auth, ip: '127.0.0.1' };
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('AuthGuard', () => {
  let ledgerSink: { emitAuthFailure: ReturnType<typeof vi.fn> };
  let guard: AuthGuard;

  beforeEach(() => {
    ledgerSink = { emitAuthFailure: vi.fn() };
    guard = new AuthGuard(ledgerSink);
    delete process.env.JWT_PUBLIC_KEY;
  });

  it('returns true for public routes', async () => {
    // Simulate @Public() metadata
    const ctx = makeCtx({});
    vi.spyOn(Reflect, 'getMetadata').mockReturnValue(true);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    vi.restoreAllMocks();
  });

  it('returns true when req.auth is already populated (DevAuth path)', async () => {
    const ctx = makeCtx({ auth: { firmId: 'f1', auditorId: 'a1', roles: ['lead_auditor'] } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('throws UnauthorizedError when no credentials present', async () => {
    const ctx = makeCtx({});
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(ledgerSink.emitAuthFailure).toHaveBeenCalledWith('no_credentials', expect.any(Object));
  });

  it('rejects tokens with alg=none', async () => {
    // Build a token manually with alg: none
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: 'u1', firmId: 'f1', roles: [] })).toString('base64url');
    const noneToken = `${header}.${payload}.`;
    const ctx = makeCtx({ headers: { authorization: `Bearer ${noneToken}` } });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(ledgerSink.emitAuthFailure).toHaveBeenCalledWith('jwt_alg_none', expect.any(Object));
  });

  it('rejects HS256 tokens (algorithm confusion attack)', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: 'u1', firmId: 'f1', roles: [] })).toString('base64url');
    const fakeToken = `${header}.${payload}.fakesignature`;
    const ctx = makeCtx({ headers: { authorization: `Bearer ${fakeToken}` } });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(ledgerSink.emitAuthFailure).toHaveBeenCalledWith(
      'jwt_symmetric_alg_rejected',
      expect.any(Object),
    );
  });

  it('rejects tokens with empty signature segment', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: 'u1', firmId: 'f1', roles: [] })).toString('base64url');
    const emptyToken = `${header}.${payload}.`;
    const ctx = makeCtx({ headers: { authorization: `Bearer ${emptyToken}` } });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(ledgerSink.emitAuthFailure).toHaveBeenCalledWith('jwt_empty_signature', expect.any(Object));
  });

  it('rejects malformed tokens (not 3 parts)', async () => {
    const ctx = makeCtx({ headers: { authorization: 'Bearer notavalidjwt' } });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(ledgerSink.emitAuthFailure).toHaveBeenCalledWith('jwt_malformed_header', expect.any(Object));
  });

  it('accepts a valid RS256 token and populates req.auth', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const { exportSPKI } = await import('jose');
    process.env.JWT_PUBLIC_KEY = await exportSPKI(publicKey);

    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ firmId: 'firm-ok', roles: ['lead_auditor'], jti: 'jti-1' })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('aud-ok')
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(privateKey);

    const req = { headers: { authorization: `Bearer ${token}` }, auth: undefined, ip: '127.0.0.1' };
    const ctx = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.auth).toMatchObject({ auditorId: 'aud-ok', firmId: 'firm-ok', roles: ['lead_auditor'] });
  });
});
