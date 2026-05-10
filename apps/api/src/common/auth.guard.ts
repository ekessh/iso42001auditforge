// SPDX-License-Identifier: BUSL-1.1
import type { CanActivate, ExecutionContext} from '@nestjs/common';
import { Injectable, Optional, SetMetadata } from '@nestjs/common';
import { importSPKI, jwtVerify } from 'jose';
import type { FastifyRequest } from 'fastify';
import type { Role } from '../adapters/auth-core.adapter.js';
import { UnauthorizedError } from './errors.js';

export const PUBLIC_KEY = 'isPublic';
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(PUBLIC_KEY, true);

/**
 * CallerContext carries enough identity information for the ledger sink.
 * Populated by AuthGuard when a verified JWT is present.
 */
export interface CallerContext {
  auditorId: string;
  firmId: string;
  roles: readonly Role[];
  jti: string;
}

/**
 * LedgerSink interface — injected so the guard can emit auth-failure events
 * without a hard dependency on the audit-engine package.
 * Implementation is provided by AuditLedgerModule; tests can inject a stub.
 */
export interface LedgerSink {
  emitAuthFailure(reason: string, context: Partial<CallerContext> & { ip?: string }): void | Promise<void>;
}

export const LEDGER_SINK = Symbol('LEDGER_SINK');

/** Explicit algorithm allowlist — alg=none and RS→HS confusion are both rejected. */
const ALLOWED_ALGORITHMS = ['RS256', 'EdDSA'] as const;

@Injectable()
export class AuthGuard implements CanActivate {
  /**
   * ledgerSink is optional — may be undefined when no provider is registered
   * (dev environments without the audit-engine module active).
   */
  constructor(
    @Optional() private readonly ledgerSink?: LedgerSink,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic =
      Reflect.getMetadata(PUBLIC_KEY, context.getHandler()) ||
      Reflect.getMetadata(PUBLIC_KEY, context.getClass());
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<FastifyRequest>();

    // Path 1: req.auth already populated by DevAuthMiddleware (non-production only).
    if (req.auth) return true;

    // Path 2: Bearer JWT in Authorization header.
    const authHeader = req.headers['authorization'];
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      await this.verifyBearerToken(req, token);
      return true;
    }

    // No auth present.
    void this.ledgerSink?.emitAuthFailure('no_credentials', {
      ...(typeof req.ip === 'string' ? { ip: req.ip } : {}),
    });
    throw new UnauthorizedError();
  }

  private async verifyBearerToken(req: FastifyRequest, token: string): Promise<void> {
    // Structural and algorithm checks run before the public-key lookup so that
    // malformed or forbidden tokens are rejected with the correct event reason
    // regardless of whether JWT_PUBLIC_KEY is configured.
    let header: Record<string, unknown>;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('malformed');
      header = JSON.parse(Buffer.from(parts[0] ?? '', 'base64url').toString('utf8')) as Record<
        string,
        unknown
      >;
    } catch {
      void this.ledgerSink?.emitAuthFailure('jwt_malformed_header', {});
      throw new UnauthorizedError('Malformed token');
    }

    const alg = header['alg'];
    if (alg === 'none' || alg === '' || alg === null || alg === undefined) {
      void this.ledgerSink?.emitAuthFailure('jwt_alg_none', {});
      throw new UnauthorizedError('Token algorithm not permitted');
    }

    // Reject symmetric algorithms — prevents RS→HS confusion attacks where an
    // attacker re-signs with the public key used as an HMAC secret.
    if (typeof alg === 'string' && /^HS/i.test(alg)) {
      void this.ledgerSink?.emitAuthFailure('jwt_symmetric_alg_rejected', { roles: [] });
      throw new UnauthorizedError('Token algorithm not permitted');
    }

    // Signature must not be empty (zero-length third segment).
    const sigSegment = token.split('.')[2];
    if (!sigSegment || sigSegment.length === 0) {
      void this.ledgerSink?.emitAuthFailure('jwt_empty_signature', {});
      throw new UnauthorizedError('Token signature missing');
    }

    const publicKeyPem = process.env.JWT_PUBLIC_KEY;
    if (!publicKeyPem) {
      void this.ledgerSink?.emitAuthFailure('jwt_public_key_not_configured', {});
      throw new UnauthorizedError('JWT verification not configured');
    }

    let payload: Record<string, unknown>;
    try {
      const key = await importSPKI(publicKeyPem, alg as string);
      const result = await jwtVerify(token, key, {
        algorithms: [...ALLOWED_ALGORITHMS],
      });
      payload = result.payload as Record<string, unknown>;
    } catch {
      void this.ledgerSink?.emitAuthFailure('jwt_verification_failed', {
        ...(typeof req.ip === 'string' ? { ip: req.ip } : {}),
      });
      throw new UnauthorizedError('Invalid or expired token');
    }

    // Extract claims and populate req.auth for downstream guards.
    const auditorId = typeof payload['sub'] === 'string' ? payload['sub'] : undefined;
    const firmId = typeof payload['firmId'] === 'string' ? payload['firmId'] : undefined;
    const jti = typeof payload['jti'] === 'string' ? payload['jti'] : undefined;
    const rawRoles = Array.isArray(payload['roles']) ? payload['roles'] : [];
    const roles = rawRoles.filter((r): r is Role => typeof r === 'string') as Role[];

    if (!auditorId || !firmId) {
      void this.ledgerSink?.emitAuthFailure('jwt_missing_claims', {});
      throw new UnauthorizedError('Token missing required claims');
    }

    req.auth = {
      auditorId,
      firmId,
      roles,
    };
    // jti is available for audit logging but not stored on req.auth (not in AuthSession shape).
    void jti;
  }
}
