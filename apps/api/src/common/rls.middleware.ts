// SPDX-License-Identifier: BUSL-1.1
import type { NestMiddleware } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import { TenancyAdapter } from '../adapters/tenancy.adapter.js';
import { type Role, can } from '../adapters/auth-core.adapter.js';
import { UnauthorizedError } from './errors.js';
import { RequestContextStore } from './request-context.js';

interface AuthSession {
  firmId: string;
  auditorId: string;
  roles: readonly Role[];
  engagementId?: string;
  webAuthnAttestation?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthSession;
  }
}

@Injectable()
export class RlsContextMiddleware implements NestMiddleware {
  constructor(@Inject(TenancyAdapter) private readonly tenancy: TenancyAdapter) {}

  use(req: FastifyRequest, _res: FastifyReply, next: (err?: unknown) => void): void {
    // Auth resolution happens in identity guards; if absent, public endpoints handle in-route.
    const auth = req.auth;
    const requestId = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
    const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

    if (!auth) {
      // Public-route path; downstream guards decide.
      next();
      return;
    }

    void this.tenancy; // adapter is wired here; per-connection SET LOCAL is applied in repos.

    RequestContextStore.run(
      {
        requestId,
        firmId: auth.firmId,
        auditorId: auth.auditorId,
        engagementId: auth.engagementId,
        roles: auth.roles,
        webAuthnAttestation: auth.webAuthnAttestation,
        idempotencyKey,
      },
      () => next(),
    );
  }
}

export function requireAuth(req: FastifyRequest): AuthSession {
  if (!req.auth) throw new UnauthorizedError();
  return req.auth;
}

export const RbacUtil = { can };
