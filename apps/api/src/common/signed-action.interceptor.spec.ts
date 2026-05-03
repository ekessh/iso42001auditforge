// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { of } from 'rxjs';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { SignedActionInterceptor, REQUIRES_SIGNED } from './signed-action.interceptor.js';
import type { WebAuthnService } from '@auditforge/auth-core';
import type { LedgerSink } from './auth.guard.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeCtx(opts: {
  requiresSigned?: boolean;
  headers?: Record<string, string | undefined>;
  auth?: Record<string, unknown>;
  challenge?: string;
}): ExecutionContext {
  const req: Partial<FastifyRequest> & { auth?: Record<string, unknown> } = {
    headers: (opts.headers ?? {}) as never,
    auth: opts.auth as never,
    ip: '127.0.0.1',
    signedActionChallenge: opts.challenge,
  };
  const handler = {};
  vi.spyOn(Reflect, 'getMetadata').mockImplementation((key: unknown) => {
    if (key === REQUIRES_SIGNED) return opts.requiresSigned ?? false;
    return undefined;
  });
  return {
    getHandler: () => handler,
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function makeNext(obs = of('ok')): CallHandler {
  return { handle: vi.fn().mockReturnValue(obs) };
}

function validAttestation(): string {
  return JSON.stringify({
    id: 'credential-id-123',
    rawId: 'cmF3SWQ=',
    type: 'public-key',
    response: {
      authenticatorData: 'YXV0aERhdGE=',
      clientDataJSON: 'Y2xpZW50RGF0YUpTT04=',
      signature: 'c2lnbmF0dXJl',
    },
    clientExtensionResults: {},
  });
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('SignedActionInterceptor', () => {
  let webAuthnSvc: Partial<WebAuthnService>;
  let ledger: LedgerSink;
  let interceptor: SignedActionInterceptor;

  beforeEach(() => {
    webAuthnSvc = { finishAuthentication: vi.fn() };
    ledger = { emitAuthFailure: vi.fn() };
    interceptor = SignedActionInterceptor.withService(webAuthnSvc as WebAuthnService, ledger);
    vi.restoreAllMocks();
  });

  it('passes through when @RequiresSignedAction is not set', () => {
    const ctx = makeCtx({ requiresSigned: false });
    const next = makeNext();
    interceptor.intercept(ctx, next);
    expect(next.handle).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('throws 401 when x-webauthn-attestation header is missing', async () => {
    const ctx = makeCtx({ requiresSigned: true, headers: {} });
    const next = makeNext();
    expect(() => interceptor.intercept(ctx, next)).toThrow(UnauthorizedException);
    vi.restoreAllMocks();
  });

  it('throws 401 when attestation header is a plain 32-char string (old bypass)', async () => {
    // SECURITY: any string that is not JSON must be rejected
    const bogus32 = 'a'.repeat(32);
    const ctx = makeCtx({
      requiresSigned: true,
      headers: { 'x-webauthn-attestation': bogus32 },
      challenge: 'test-challenge',
    });
    const next = makeNext();
    expect(() => interceptor.intercept(ctx, next)).toThrow(UnauthorizedException);
    expect(ledger.emitAuthFailure).toHaveBeenCalledWith('malformed_attestation_json', expect.any(Object));
    vi.restoreAllMocks();
  });

  it('throws 401 when attestation JSON is missing required fields', async () => {
    const incomplete = JSON.stringify({ id: 'x', type: 'public-key' }); // missing response
    const ctx = makeCtx({
      requiresSigned: true,
      headers: { 'x-webauthn-attestation': incomplete },
      challenge: 'test-challenge',
    });
    const next = makeNext();
    expect(() => interceptor.intercept(ctx, next)).toThrow(UnauthorizedException);
    vi.restoreAllMocks();
  });

  it('throws 401 when no challenge is present on request', async () => {
    const ctx = makeCtx({
      requiresSigned: true,
      headers: { 'x-webauthn-attestation': validAttestation() },
      challenge: undefined, // no challenge
    });
    const next = makeNext();
    expect(() => interceptor.intercept(ctx, next)).toThrow(UnauthorizedException);
    expect(ledger.emitAuthFailure).toHaveBeenCalledWith('no_challenge_on_request', expect.any(Object));
    vi.restoreAllMocks();
  });

  it('throws 401 (credential not found) when auth is present but no stored credential', async () => {
    const ctx = makeCtx({
      requiresSigned: true,
      headers: { 'x-webauthn-attestation': validAttestation() },
      challenge: 'challenge-abc',
      auth: { auditorId: 'aud-1', firmId: 'f-1', roles: ['lead_auditor'] },
    });

    return new Promise<void>((resolve, reject) => {
      const obs = interceptor.intercept(ctx, makeNext());
      obs.subscribe({
        error: (err: unknown) => {
          try {
            expect(err).toBeInstanceOf(UnauthorizedException);
            expect(ledger.emitAuthFailure).toHaveBeenCalledWith(
              'credential_not_found',
              expect.any(Object),
            );
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        next: () => reject(new Error('should not emit')),
      });
      vi.restoreAllMocks();
    });
  });
});
