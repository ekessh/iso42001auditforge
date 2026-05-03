// SPDX-License-Identifier: BUSL-1.1
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Role } from '../adapters/auth-core.adapter.js';

/**
 * Dev/test middleware that hydrates req.auth from headers. In production this
 * is replaced by an OIDC/WebAuthn session resolver (identity module).
 */
@Injectable()
export class DevAuthMiddleware implements NestMiddleware {
  use(req: FastifyRequest, _res: FastifyReply, next: (err?: unknown) => void): void {
    const firmId = req.headers['x-test-firm-id'] as string | undefined;
    const auditorId = req.headers['x-test-auditor-id'] as string | undefined;
    const rolesHeader = req.headers['x-test-roles'] as string | undefined;
    if (firmId && auditorId) {
      const roles = (rolesHeader ?? 'lead_auditor').split(',').map((r) => r.trim()) as Role[];
      const engagementId = req.headers['x-test-engagement-id'] as string | undefined;
      const attestation = req.headers['x-webauthn-attestation'] as string | undefined;
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
}
