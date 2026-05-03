// SPDX-License-Identifier: BUSL-1.1
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Role } from '../adapters/auth-core.adapter.js';

/**
 * Dev/test middleware that hydrates req.auth from headers.
 *
 * SECURITY: This middleware is ONLY active when:
 *   - NODE_ENV is not 'production', AND
 *   - AUDITFORGE_DISABLE_DEV_AUTH is not '1'
 *
 * In production this is replaced by a real OIDC/WebAuthn session resolver
 * (identity module). The middleware throws at startup if NODE_ENV is unset
 * and AUDITFORGE_DISABLE_DEV_AUTH is not explicitly disabling it.
 */
@Injectable()
export class DevAuthMiddleware implements NestMiddleware {
  constructor() {
    const nodeEnv = process.env.NODE_ENV;
    const disableDevAuth = process.env.AUDITFORGE_DISABLE_DEV_AUTH === '1';

    if (disableDevAuth) {
      // Explicitly disabled — safe in any env.
      return;
    }

    if (nodeEnv === 'production') {
      throw new Error(
        '[DevAuthMiddleware] FATAL: DevAuthMiddleware must not be registered in production. ' +
          'Set NODE_ENV=production and ensure AppModule.configure() skips this middleware.',
      );
    }

    if (!nodeEnv) {
      throw new Error(
        '[DevAuthMiddleware] FATAL: NODE_ENV is unset. ' +
          'DevAuthMiddleware refuses to activate without an explicit non-production environment. ' +
          'Set NODE_ENV=development or set AUDITFORGE_DISABLE_DEV_AUTH=1 to disable.',
      );
    }
  }

  use(req: FastifyRequest, _res: FastifyReply, next: (err?: unknown) => void): void {
    // Guard is re-checked at request time in case env vars change at runtime
    // (e.g., hot-reload in test harness).
    if (
      process.env.NODE_ENV === 'production' ||
      process.env.AUDITFORGE_DISABLE_DEV_AUTH === '1'
    ) {
      return next();
    }

    // Headers can be string | string[] | undefined in Fastify.
    // Only accept scalar string values; arrays are ignored for safety.
    const firmId = DevAuthMiddleware.scalarHeader(req, 'x-test-firm-id');
    const auditorId = DevAuthMiddleware.scalarHeader(req, 'x-test-auditor-id');
    const rolesHeader = DevAuthMiddleware.scalarHeader(req, 'x-test-roles');

    if (firmId && auditorId) {
      const roles = (rolesHeader ?? 'lead_auditor').split(',').map((r) => r.trim()) as Role[];
      const engagementId = DevAuthMiddleware.scalarHeader(req, 'x-test-engagement-id');
      const attestation = DevAuthMiddleware.scalarHeader(req, 'x-webauthn-attestation');
      req.auth = {
        firmId,
        auditorId,
        roles,
        ...(engagementId !== undefined ? { engagementId } : {}),
        ...(attestation !== undefined ? { webAuthnAttestation: attestation } : {}),
      };
    }
    next();
  }

  private static scalarHeader(req: FastifyRequest, name: string): string | undefined {
    const v = req.headers[name];
    if (typeof v === 'string') return v;
    // Array headers are rejected — never trust arrays for auth values.
    return undefined;
  }
}
