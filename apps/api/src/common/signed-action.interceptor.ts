// SPDX-License-Identifier: BUSL-1.1
import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
  Optional,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Observable } from 'rxjs';
import { WebAuthnService } from '@auditforge/auth-core';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import type { LedgerSink } from './auth.guard.js';
import type { WebAuthnCredentialRepository } from './webauthn-credential.repository.js';
import {
  MonotonicityViolationError,
  WEBAUTHN_CREDENTIAL_REPOSITORY,
} from './webauthn-credential.repository.js';

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

  constructor(
    @Optional() @Inject(SIGNED_ACTION_LEDGER_SINK)
    private readonly ledgerSink?: LedgerSink,
    @Optional() @Inject(WEBAUTHN_CREDENTIAL_REPOSITORY)
    private readonly credentialRepo?: WebAuthnCredentialRepository,
  ) {
    // Construct WebAuthnService from env — the config module is not available
    // in CommonModule without creating a circular dependency, so we read from
    // process.env directly. Tests override via withService().
    this.webAuthnSvc = new WebAuthnService({
      rpName: process.env.WEBAUTHN_RP_NAME ?? 'AuditForge',
      rpId: process.env.WEBAUTHN_RP_ID ?? 'localhost',
      origin: process.env.WEBAUTHN_ORIGIN ?? 'http://localhost:3000',
    });
  }

  /**
   * Constructor override for tests — allows injecting a mock WebAuthnService
   * and optional credential repository.
   */
  static withService(
    svc: WebAuthnService,
    ledger?: LedgerSink,
    credentialRepo?: WebAuthnCredentialRepository,
  ): SignedActionInterceptor {
    const instance = new SignedActionInterceptor(ledger, credentialRepo);
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

    // Return an Observable that awaits the async verification before passing
    // to the handler.
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
    if (!req.auth) {
      this.emitFailure('missing_auth_context', req);
      throw new UnauthorizedException('No authentication context for signed action');
    }

    // Look up the stored credential from the Drizzle-backed repository.
    if (!this.credentialRepo) {
      // Repository not injected — this means the module is misconfigured.
      // Fail secure: reject the request rather than silently skipping verification.
      this.emitFailure('credential_repo_not_configured', req);
      throw new UnauthorizedException('Signed action credential store not available');
    }

    const credRecord = await this.credentialRepo.getByCredentialId(authResponse.id);

    if (!credRecord) {
      this.emitFailure('credential_not_found', req);
      throw new UnauthorizedException('WebAuthn credential not found for this auditor');
    }

    // Verify that the credential belongs to the authenticated auditor.
    if (credRecord.auditorId !== req.auth.auditorId) {
      this.emitFailure('credential_auditor_mismatch', req, {
        credentialAuditorId: credRecord.auditorId,
      });
      throw new UnauthorizedException('WebAuthn credential does not belong to this auditor');
    }

    // Build a StoredCredential compatible with @auditforge/auth-core.
    const storedCredential = {
      credentialId: credRecord.credentialId,
      publicKey: credRecord.publicKey,
      counter: credRecord.counter,
      transports: credRecord.transports as import('@auditforge/auth-core').StoredCredential['transports'],
    };

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

    const newCounter = verified.authenticationInfo.newCounter;

    // Counter must strictly increase to prevent replay. The repository
    // enforces this at the SQL level too (monotonicity constraint).
    if (newCounter !== undefined && newCounter <= credRecord.counter) {
      this.emitFailure('webauthn_counter_replay', req, {
        stored: credRecord.counter,
        received: newCounter,
      });
      throw new UnauthorizedException('WebAuthn counter did not increase — possible replay');
    }

    // Persist the updated counter. MonotonicityViolationError is a second
    // defense line at the repository/SQL layer.
    if (newCounter !== undefined) {
      try {
        await this.credentialRepo.incrementCounter(credRecord.credentialId, newCounter);
      } catch (e) {
        if (e instanceof MonotonicityViolationError) {
          this.emitFailure('webauthn_counter_replay_sql', req, {
            stored: e.storedCounter,
            received: e.receivedCounter,
          });
          throw new UnauthorizedException('WebAuthn counter did not increase — possible replay');
        }
        throw e;
      }
    }

    void this.ledgerSink?.emitAuthFailure('signed_action_verified', {
      auditorId: req.auth.auditorId,
      firmId: req.auth.firmId,
      roles: req.auth.roles,
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
