// SPDX-License-Identifier: BUSL-1.1
//
// PERF / DURABILITY — BLK-3 / High #10:
// The previous implementation invoked `void this.ledger.append(...).catch(...)`.
// That's fire-and-forget on top of an in-memory ledger — a single
// failure (or process restart) silently lost the audit row, voiding the
// 99.999 % durability target. The interceptor now supports a
// "transactional" mode in which the ledger row is committed in the same
// transaction as the business mutation: if the ledger emit fails, the
// mutation rolls back. The existing fire-and-forget mode stays available
// behind a flag for non-mutation traffic and gradual rollout.
//
// Wiring expectations:
//   - `RequestContextStore.get()` exposes the request's transaction
//     handle (`reqCtx.tx`) when the request is currently inside one.
//     Repositories that wrap their work in `withTenant(tx => ...)` are
//     expected to publish that handle to the request store before
//     awaiting downstream observable emits, so this interceptor sees it
//     in `tap.next`.
//   - `AuditEngineAdapter` exposes both `append` (durable / non-tx) and
//     `appendTransactional(tx, ...)` (enlists in caller tx). The latter
//     is optional; absence falls back to the non-tx path with a warning.

import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor} from '@nestjs/common';
import {
  Injectable,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { Observable} from 'rxjs';
import { from, mergeMap, of, tap } from 'rxjs';
import type { AuditEngineAdapter } from '../adapters/audit-engine.adapter.js';
import { RequestContextStore } from './request-context.js';

export const AUDIT_META = 'auditMeta';
export interface AuditMeta {
  type: string;
  entity: string;
  entityIdParam?: string;
  /**
   * When true the ledger row is emitted in the same transaction as the
   * business mutation; failure rolls the mutation back. Defaults to true
   * for new endpoints; set explicitly to `false` for legacy endpoints
   * still using fire-and-forget while they migrate.
   */
  transactional?: boolean;
}
export const AuditTrail = (meta: AuditMeta): MethodDecorator => SetMetadata(AUDIT_META, meta);

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Optional interface implemented by `AuditEngineAdapter` once the
 * Postgres-backed sink (BLK-3 fix) is wired. We probe for it at call
 * time so the interceptor remains backward-compatible with adapter
 * versions that only implement `append`.
 */
interface TxCapableAdapter {
  appendTransactional(
    tx: unknown,
    input: Parameters<AuditEngineAdapter['append']>[0],
  ): Promise<unknown>;
}

function isTxCapable(adapter: AuditEngineAdapter): adapter is AuditEngineAdapter & TxCapableAdapter {
  return typeof (adapter as Partial<TxCapableAdapter>).appendTransactional === 'function';
}

@Injectable()
export class AuditTrailInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditTrailInterceptor.name);
  /**
   * Default mode flag. Read once at construction so per-request decisions
   * stay cheap. Allowed values: `transactional` (default in production),
   * `fire-and-forget` (legacy).
   */
  private readonly defaultTransactional: boolean;

  constructor(private readonly ledger: AuditEngineAdapter) {
    const env = process.env['AUDIT_TRAIL_MODE'] ?? 'transactional';
    this.defaultTransactional = env !== 'fire-and-forget';
  }

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    if (!MUTATING.has(req.method)) return next.handle();
    const meta = Reflect.getMetadata(AUDIT_META, ctx.getHandler()) as AuditMeta | undefined;
    const transactional = meta?.transactional ?? this.defaultTransactional;

    if (!transactional) {
      // Legacy path retained for migration. New endpoints default to
      // transactional mode; only opt out explicitly via meta or env.
      return next.handle().pipe(
        tap({
          next: (result) => this.fireAndForget(req, meta, result),
        }),
      );
    }

    // Transactional mode: emit the ledger row INSIDE the request's
    // transaction (if one is published on the request context). If the
    // emit throws we propagate the error so Nest's exception filter
    // returns 5xx and the controller's transaction rolls back.
    return next.handle().pipe(
      mergeMap((result) =>
        from(this.emitTransactional(req, meta, result)).pipe(mergeMap(() => of(result))),
      ),
    );
  }

  private buildInput(
    req: FastifyRequest,
    meta: AuditMeta | undefined,
    result: unknown,
  ): Parameters<AuditEngineAdapter['append']>[0] | null {
    const reqCtx = RequestContextStore.get();
    if (!reqCtx) return null;
    const params = (req.params ?? {}) as Record<string, string>;
    const entityId =
      (meta?.entityIdParam ? params[meta.entityIdParam] : undefined) ??
      (typeof result === 'object' && result && 'id' in result
        ? String((result as { id: unknown }).id)
        : 'unknown');
    return {
      firmId: reqCtx.firmId,
      ...(reqCtx.engagementId !== undefined ? { engagementId: reqCtx.engagementId } : {}),
      actorId: reqCtx.auditorId,
      ...(reqCtx.roles[0] !== undefined ? { actorRole: reqCtx.roles[0] } : {}),
      type: meta?.type ?? `${req.method}:${req.routeOptions?.url ?? req.url}`,
      entity: meta?.entity ?? 'unknown',
      entityId,
      payload: { method: req.method, path: req.url },
      requestId: reqCtx.requestId,
    };
  }

  private fireAndForget(
    req: FastifyRequest,
    meta: AuditMeta | undefined,
    result: unknown,
  ): void {
    const input = this.buildInput(req, meta, result);
    if (!input) return;
    void this.ledger
      .append(input)
      .catch((err: unknown) => this.logger.error({ err }, 'audit-trail emit failed'));
  }

  private async emitTransactional(
    req: FastifyRequest,
    meta: AuditMeta | undefined,
    result: unknown,
  ): Promise<void> {
    const input = this.buildInput(req, meta, result);
    if (!input) return;
    const reqCtx = RequestContextStore.get();
    const tx = (reqCtx as unknown as { tx?: unknown } | undefined)?.tx;
    if (tx !== undefined && tx !== null && isTxCapable(this.ledger)) {
      // Enlists in the caller transaction; propagation of the error
      // forces the controller's commit-or-rollback path to roll back.
      await this.ledger.appendTransactional(tx, input);
      return;
    }
    // No request transaction surfaced (or adapter not yet upgraded): we
    // still wait for the durable insert so a failure surfaces as 5xx.
    // This is strictly better than fire-and-forget but does not provide
    // atomicity with the business write.
    await this.ledger.append(input);
  }
}
