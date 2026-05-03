// SPDX-License-Identifier: BUSL-1.1
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Observable } from 'rxjs';
import { WebAuthnService } from '@auditforge/auth-core';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import type { LedgerSink } from './auth.guard.js';

export const REQUIRES_SIGNED = 'requiresSigned';
export const RequiresSignedAction = (): MethodDecorator => SetMetadata(REQUIRES_SIGNED, true);

/**
 * Decorator that injects a server-generated challenge into the request so that
 * downstream handlers can verify it was answered by the correct authenticator.
 *
 * Usage on a controller method:
 *   @SignedAction()
 *   @RequiresSignedAction()
 *   async signReport(...) { ... }
 */
export const SIGNED_ACTION_CHALLENGE = 'signedActionChallenge';
export const SignedAction = (): MethodDecorator => SetMetadata(SIGNED_ACTION_CHALLENGE, true);

/** Injection token for an optional LedgerSink in SignedActionInterceptor. */
export const SIGNED_ACTION_LEDGER_SINK = Symbol('SIGNED_ACTION_LEDGER_SINK');

/**
 * Expected shape of the x-webauthn-attestation header value (JSON-encoded).
 *
 * Matches a subset of AuthenticationResponseJSON from @simplewebauthn/types.
 */
interface AttestationPayload {
  id: string;
  rawId: string;
  response: {
    authenticatorData: string;
    clientDataJSON: string;
    signature: string;
    userHandle?: string;
  };
  type: 'public-key';
  clientExtensionResults?: Record<string, unknown>;
}

/** Per-request challenge keyed by (auditorId + action + resourceId). */
declare module 'fastify' {
  interface FastifyRequest {
    signedActionChallenge?: string;
  }
}

@Injectable()
export class SignedActionInterceptor implements NestInterceptor {
  private readonly webAuthnSvc: WebAuthnService;

  constructor(private readonly ledgerSink?: LedgerSink) {
    // Construct WebAuthnService from env — this avoids a hard DI dependency on
    // a separately-provided token while still allowing injection in tests.
    // TODO(phase-rls): promote to an injected token once the config module
    // is accessible from CommonModule.
    this.webAuthnSvc = new WebAuthnService({
      rpName: process.env.WEBAUTHN_RP_NAME ?? 'AuditForge',
      rpId: process.env.WEBAUTHN_RP_ID ?? 'localhost',
      origin: process.env.WEBAUTHN_ORIGIN ?? 'http://localhost:3000',
    });
  }

  /** Constructor override for tests — allows injecting a mock WebAuthnService. */
  static withService(svc: WebAuthnService, ledger?: LedgerSink): SignedActionInterceptor {
    const instance = new SignedActionInterceptor(ledger);
    (instance as { webAuthnSvc: WebAuthnService }).webAuthnSvc = svc;
    return instance;
  }

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const required = Reflect.getMetadata(REQUIRES_SIGNED, ctx.getHandler()) === true;
    if (!required) return next.handle();

    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    const raw = req.headers['x-webauthn-attestation'];

    // Header must be a scalar string — arrays are rejected.
    if (typeof raw !== 'string' || raw.length === 0) {
      this.emitFailure('missing_attestation_header', req);
      throw new UnauthorizedException('Signed action requires x-webauthn-attestation header');
    }

    // Parse as JSON — any non-JSON value (including plain 16-char strings)
    // is rejected, closing the old bypass.
    let parsed: AttestationPayload;
    try {
      const candidate = JSON.parse(raw) as unknown;
      if (!isAttestationPayload(candidate)) {
        throw new Error('schema mismatch');
      }
      parsed = candidate;
    } catch {
      this.emitFailure('malformed_attestation_json', req);
      throw new UnauthorizedException('Attestation header is not valid JSON or has wrong shape');
    }

    // Challenge must be present on the request (injected by prior middleware or
    // by the @SignedAction() decorator handler).
    const expectedChallenge = req.signedActionChallenge;
    if (!expectedChallenge) {
      this.emitFailure('no_challenge_on_request', req);
      throw new UnauthorizedException('No signed-action challenge found for this request');
    }

    // Build the AuthenticationResponseJSON expected by SimpleWebAuthn.
    const authResponse: AuthenticationResponseJSON = {
      id: parsed.id,
      rawId: parsed.rawId,
      response: {
        authenticatorData: parsed.response.authenticatorData,
        clientDataJSON: parsed.response.clientDataJSON,
        signature: parsed.response.signature,
        userHandle: parsed.response.userHandle,
      },
      type: 'public-key',
      clientExtensionResults: parsed.clientExtensionResults ?? {},
    };

    // We cannot make this async easily with a sync intercept, so we return an
    // Observable that awaits the verification before passing to the handler.
    return new Observable((subscriber) => {
      this.verifyAndProceed(authResponse, expectedChallenge, req, next)
        .then((obs) => obs.subscribe(subscriber))
        .catch((err: unknown) => subscriber.error(err));
    });
  }

  private async verifyAndProceed(
    authResponse: AuthenticationResponseJSON,
    expectedChallenge: string,
    req: FastifyRequest,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    // Retrieve the stored credential for this auditor.
    // TODO(phase-rls): load credential from the Drizzle-backed credentials repository.
    const storedCredential = req.auth
      ? await this.loadStoredCredential(req.auth.auditorId, authResponse.id)
      : undefined;

    if (!storedCredential) {
      this.emitFailure('credential_not_found', req);
      throw new UnauthorizedException('WebAuthn credential not found for this auditor');
    }

    let verified: Awaited<ReturnType<WebAuthnService['finishAuthentication']>>;
    try {
      verified = await this.webAuthnSvc.finishAuthentication(
        authResponse,
        expectedChallenge,
        storedCredential,
      );
    } catch (e) {
      this.emitFailure('webauthn_verification_failed', req, { detail: String(e) });
      throw new UnauthorizedException('WebAuthn attestation verification failed');
    }

    if (!verified.verified) {
      this.emitFailure('webauthn_not_verified', req);
      throw new UnauthorizedException('WebAuthn attestation could not be verified');
    }

    // Counter must strictly increase to prevent replay.
    if (
      verified.authenticationInfo.newCounter !== undefined &&
      verified.authenticationInfo.newCounter <= storedCredential.counter
    ) {
      this.emitFailure('webauthn_counter_replay', req, {
        stored: storedCredential.counter,
        received: verified.authenticationInfo.newCounter,
      });
      throw new UnauthorizedException('WebAuthn counter did not increase — possible replay');
    }

    // TODO(phase-rls): persist updated counter to the credentials repository.

    void this.ledgerSink?.emitAuthFailure('signed_action_verified', {
      auditorId: req.auth?.auditorId,
      firmId: req.auth?.firmId,
      roles: req.auth?.roles,
    });

    return next.handle();
  }

  private emitFailure(reason: string, req: FastifyRequest, extras?: Record<string, unknown>): void {
    void this.ledgerSink?.emitAuthFailure(reason, {
      auditorId: req.auth?.auditorId,
      firmId: req.auth?.firmId,
      roles: req.auth?.roles,
      ip: typeof req.ip === 'string' ? req.ip : undefined,
      ...extras,
    });
  }

  /**
   * Load a stored WebAuthn credential for the given auditor and credentialId.
   *
   * TODO(phase-rls): replace with a real repository call to the Drizzle-backed
   * credentials table. Current implementation is an in-memory stub.
   */
  private async loadStoredCredential(
    _auditorId: string,
    _credentialId: string,
  ): Promise<import('@auditforge/auth-core').StoredCredential | undefined> {
    // Placeholder — always returns undefined (credential not found) until
    // the real repository is wired in. This means ALL signed-action attempts
    // fail with 401 until phase-rls is complete, which is a safe default.
    return undefined;
  }
}

// ── type guard ────────────────────────────────────────────────────────────────

function isAttestationPayload(v: unknown): v is AttestationPayload {
  if (typeof v !== 'object' || v === null) return false;
  const obj = v as Record<string, unknown>;
  if (typeof obj['id'] !== 'string' || obj['id'].length === 0) return false;
  if (typeof obj['rawId'] !== 'string') return false;
  if (obj['type'] !== 'public-key') return false;
  const resp = obj['response'];
  if (typeof resp !== 'object' || resp === null) return false;
  const r = resp as Record<string, unknown>;
  if (typeof r['authenticatorData'] !== 'string') return false;
  if (typeof r['clientDataJSON'] !== 'string') return false;
  if (typeof r['signature'] !== 'string') return false;
  return true;
}
