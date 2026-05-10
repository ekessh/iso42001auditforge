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

import type { WebAuthnCredentialRepository, CredentialRecord } from './webauthn-credential.repository.js';
import { MonotonicityViolationError } from './webauthn-credential.repository.js';

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
    ...(opts.challenge !== undefined ? { signedActionChallenge: opts.challenge } : {}),
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

function validAttestation(credentialId = 'credential-id-123'): string {
  return JSON.stringify({
    id: credentialId,
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

function makeCredRecord(overrides: Partial<CredentialRecord> = {}): CredentialRecord {
  return {
    credentialId: 'credential-id-123',
    publicKey: new Uint8Array([1, 2, 3]),
    counter: 5,
    auditorId: 'aud-1',
    firmId: 'firm-1',
    userVerified: true,
    transports: ['internal'],
    aaguid: null,
    ...overrides,
  };
}

function makeCredRepo(overrides: Partial<WebAuthnCredentialRepository> = {}): WebAuthnCredentialRepository {
  return {
    getByCredentialId: vi.fn().mockResolvedValue(null),
    incrementCounter: vi.fn().mockResolvedValue(undefined),
    revoke: vi.fn().mockResolvedValue(undefined),
    listForAuditor: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('SignedActionInterceptor', () => {
  let webAuthnSvc: Partial<WebAuthnService>;
  let ledger: LedgerSink;
  let credRepo: WebAuthnCredentialRepository;
  let interceptor: SignedActionInterceptor;

  beforeEach(() => {
    webAuthnSvc = { finishAuthentication: vi.fn() };
    ledger = { emitAuthFailure: vi.fn() };
    credRepo = makeCredRepo();
    interceptor = SignedActionInterceptor.withService(webAuthnSvc as WebAuthnService, ledger, credRepo);
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
      // challenge intentionally absent — tests that no challenge on req triggers 401
    });
    const next = makeNext();
    expect(() => interceptor.intercept(ctx, next)).toThrow(UnauthorizedException);
    expect(ledger.emitAuthFailure).toHaveBeenCalledWith('no_challenge_on_request', expect.any(Object));
    vi.restoreAllMocks();
  });

  it('throws 401 (credential not found) when auth is present but no stored credential', async () => {
    // credRepo.getByCredentialId returns null by default
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

  it('passes through when stored credential exists + valid signature + monotonic counter', async () => {
    const cred = makeCredRecord({ counter: 5, auditorId: 'aud-1' });
    credRepo = makeCredRepo({
      getByCredentialId: vi.fn().mockResolvedValue(cred),
      incrementCounter: vi.fn().mockResolvedValue(undefined),
    });
    interceptor = SignedActionInterceptor.withService(
      {
        finishAuthentication: vi.fn().mockResolvedValue({
          verified: true,
          authenticationInfo: { newCounter: 6 },
        }),
      } as unknown as WebAuthnService,
      ledger,
      credRepo,
    );

    const ctx = makeCtx({
      requiresSigned: true,
      headers: { 'x-webauthn-attestation': validAttestation('credential-id-123') },
      challenge: 'challenge-xyz',
      auth: { auditorId: 'aud-1', firmId: 'firm-1', roles: ['lead_auditor'] },
    });

    return new Promise<void>((resolve, reject) => {
      const obs = interceptor.intercept(ctx, makeNext(of('result')));
      obs.subscribe({
        next: (val) => {
          try {
            expect(val).toBe('result');
            expect(credRepo.incrementCounter).toHaveBeenCalledWith('credential-id-123', 6);
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        error: (e: unknown) => reject(e),
      });
      vi.restoreAllMocks();
    });
  });

  it('throws 401 and emits replay-attempt when counter is stale', async () => {
    const cred = makeCredRecord({ counter: 10, auditorId: 'aud-1' });
    credRepo = makeCredRepo({
      getByCredentialId: vi.fn().mockResolvedValue(cred),
    });
    interceptor = SignedActionInterceptor.withService(
      {
        finishAuthentication: vi.fn().mockResolvedValue({
          verified: true,
          // newCounter <= stored counter → replay attempt
          authenticationInfo: { newCounter: 9 },
        }),
      } as unknown as WebAuthnService,
      ledger,
      credRepo,
    );

    const ctx = makeCtx({
      requiresSigned: true,
      headers: { 'x-webauthn-attestation': validAttestation('credential-id-123') },
      challenge: 'challenge-xyz',
      auth: { auditorId: 'aud-1', firmId: 'firm-1', roles: ['lead_auditor'] },
    });

    return new Promise<void>((resolve, reject) => {
      const obs = interceptor.intercept(ctx, makeNext());
      obs.subscribe({
        error: (err: unknown) => {
          try {
            expect(err).toBeInstanceOf(UnauthorizedException);
            expect(ledger.emitAuthFailure).toHaveBeenCalledWith(
              'webauthn_counter_replay',
              expect.objectContaining({ stored: 10, received: 9 }),
            );
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        next: () => reject(new Error('should not emit value on replay')),
      });
      vi.restoreAllMocks();
    });
  });

  it('throws 401 when the SQL monotonicity layer catches a replay via incrementCounter', async () => {
    const cred = makeCredRecord({ counter: 5, auditorId: 'aud-1' });
    credRepo = makeCredRepo({
      getByCredentialId: vi.fn().mockResolvedValue(cred),
      // Simulate the SQL CHECK firing: incrementCounter throws even though the
      // application-level check passed (race window between two requests).
      incrementCounter: vi.fn().mockRejectedValue(
        new MonotonicityViolationError('credential-id-123', 5, 5),
      ),
    });
    interceptor = SignedActionInterceptor.withService(
      {
        finishAuthentication: vi.fn().mockResolvedValue({
          verified: true,
          authenticationInfo: { newCounter: 6 },
        }),
      } as unknown as WebAuthnService,
      ledger,
      credRepo,
    );

    const ctx = makeCtx({
      requiresSigned: true,
      headers: { 'x-webauthn-attestation': validAttestation('credential-id-123') },
      challenge: 'challenge-xyz',
      auth: { auditorId: 'aud-1', firmId: 'firm-1', roles: ['lead_auditor'] },
    });

    return new Promise<void>((resolve, reject) => {
      const obs = interceptor.intercept(ctx, makeNext());
      obs.subscribe({
        error: (err: unknown) => {
          try {
            expect(err).toBeInstanceOf(UnauthorizedException);
            expect(ledger.emitAuthFailure).toHaveBeenCalledWith(
              'webauthn_counter_replay_sql',
              expect.any(Object),
            );
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        next: () => reject(new Error('should not emit value on sql-layer replay')),
      });
      vi.restoreAllMocks();
    });
  });

  it('throws 401 when credential belongs to a different auditor', async () => {
    const cred = makeCredRecord({ counter: 5, auditorId: 'aud-other' }); // different auditor
    credRepo = makeCredRepo({
      getByCredentialId: vi.fn().mockResolvedValue(cred),
    });
    interceptor = SignedActionInterceptor.withService(
      webAuthnSvc as WebAuthnService,
      ledger,
      credRepo,
    );

    const ctx = makeCtx({
      requiresSigned: true,
      headers: { 'x-webauthn-attestation': validAttestation('credential-id-123') },
      challenge: 'challenge-xyz',
      auth: { auditorId: 'aud-1', firmId: 'firm-1', roles: ['lead_auditor'] }, // different
    });

    return new Promise<void>((resolve, reject) => {
      const obs = interceptor.intercept(ctx, makeNext());
      obs.subscribe({
        error: (err: unknown) => {
          try {
            expect(err).toBeInstanceOf(UnauthorizedException);
            expect(ledger.emitAuthFailure).toHaveBeenCalledWith(
              'credential_auditor_mismatch',
              expect.any(Object),
            );
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        next: () => reject(new Error('should not emit for mismatch')),
      });
      vi.restoreAllMocks();
    });
  });
});
