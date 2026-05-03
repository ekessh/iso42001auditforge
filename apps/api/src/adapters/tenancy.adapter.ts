// SPDX-License-Identifier: BUSL-1.1
//
// Tenancy adapter — delegates RLS session-variable management to
// `@auditforge/tenancy-core` (`withTenantContext`). The package issues the
// canonical `set_tenant_context($firm, $auditor)` SQL helper and resets the
// session in a `finally`. The adapter wraps that for callers that still need
// the legacy `applyContext` / `clearContext` shape (the previous in-house
// implementation), but production code paths should use `withTenantContext`
// directly via `BaseRepository.withTenant`.

import { Injectable, Logger } from '@nestjs/common';
import {
  withTenantContext,
  type TransactionExecutor,
} from '@auditforge/tenancy-core';
import type { TenantContext as PkgTenantContext } from '@auditforge/shared';

/**
 * The runtime contract the API uses on top of tenancy-core. Roles and the
 * optional engagement scope are API-only — the package's TenantContext
 * deliberately keeps to the minimum the database needs.
 */
export interface TenantContext {
  firmId: string;
  auditorId: string;
  engagementId?: string | undefined;
  roles: readonly string[];
}

export interface RlsSetter {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
}

@Injectable()
export class TenancyAdapter {
  private readonly logger = new Logger(TenancyAdapter.name);

  /**
   * Apply RLS session vars on a connection. Used by the legacy callers that
   * manage their own transaction lifecycle. Prefer `runWithContext` for
   * one-shot wrapping.
   */
  async applyContext(conn: RlsSetter, ctx: TenantContext): Promise<void> {
    await conn.query('SELECT set_tenant_context($1::uuid, $2::uuid)', [
      ctx.firmId,
      ctx.auditorId,
    ]);
    if (ctx.engagementId) {
      // Engagement scoping is API-side only (RLS only knows firm+auditor at
      // this layer). Setting the session var lets app code consult it.
      await conn.query('SET LOCAL app.current_engagement_id = $1', [ctx.engagementId]);
    }
  }

  async clearContext(conn: RlsSetter): Promise<void> {
    await conn.query('SELECT clear_tenant_context()');
    await conn.query('RESET app.current_engagement_id').catch(() => undefined);
  }

  /**
   * Wrap a callback in a tenancy-core transaction. The package opens a
   * Postgres tx, sets the canonical session vars, runs `fn`, and resets
   * cleanly even on throw.
   *
   * `executor` MUST be a `TransactionExecutor` — Drizzle/postgres-js callers
   * should use the small adapter in `db/base.repository.ts`.
   */
  async runWithContext<T>(
    executor: TransactionExecutor,
    ctx: TenantContext,
    fn: (tx: TransactionExecutor) => Promise<T>,
  ): Promise<T> {
    const pkgCtx: PkgTenantContext = {
      firmId: ctx.firmId,
      auditorId: ctx.auditorId,
      ...(ctx.engagementId !== undefined ? { engagementId: ctx.engagementId } : {}),
    };
    return withTenantContext(executor, pkgCtx, fn);
  }
}
