// SPDX-License-Identifier: BUSL-1.1
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Observable, tap } from 'rxjs';
import { AuditEngineAdapter } from '../adapters/audit-engine.adapter.js';
import { RequestContextStore } from './request-context.js';

export const AUDIT_META = 'auditMeta';
export interface AuditMeta {
  type: string;
  entity: string;
  entityIdParam?: string;
}
export const AuditTrail = (meta: AuditMeta): MethodDecorator => SetMetadata(AUDIT_META, meta);

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class AuditTrailInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditTrailInterceptor.name);
  constructor(private readonly ledger: AuditEngineAdapter) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    if (!MUTATING.has(req.method)) return next.handle();
    const meta = Reflect.getMetadata(AUDIT_META, ctx.getHandler()) as AuditMeta | undefined;

    return next.handle().pipe(
      tap({
        next: (result) => {
          const reqCtx = RequestContextStore.get();
          if (!reqCtx) return;
          const params = (req.params ?? {}) as Record<string, string>;
          const entityId =
            (meta?.entityIdParam ? params[meta.entityIdParam] : undefined) ??
            (typeof result === 'object' && result && 'id' in result ? String((result as { id: unknown }).id) : 'unknown');
          void this.ledger
            .append({
              firmId: reqCtx.firmId,
              ...(reqCtx.engagementId !== undefined ? { engagementId: reqCtx.engagementId } : {}),
              actorId: reqCtx.auditorId,
              actorRole: reqCtx.roles[0],
              type: meta?.type ?? `${req.method}:${req.routeOptions?.url ?? req.url}`,
              entity: meta?.entity ?? 'unknown',
              entityId,
              payload: { method: req.method, path: req.url },
              requestId: reqCtx.requestId,
            })
            .catch((err: unknown) => this.logger.error({ err }, 'audit-trail emit failed'));
        },
      }),
    );
  }
}
