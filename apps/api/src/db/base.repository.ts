// SPDX-License-Identifier: BUSL-1.1
//
// BaseRepository — opens a postgres-js transaction, delegates RLS session
// variable management to `@auditforge/tenancy-core` (`withTenantContext`),
// and runs the caller's handler with the tenant context applied.
//
// `withTenant` is the only sanctioned write/read entry point for repositories
// that go through Postgres. It uses the package's canonical
// `set_tenant_context($firm, $auditor)` SQL helper rather than ad-hoc SET
// LOCAL strings, so RLS policies pick up the same session variables in test
// and prod.

import { Inject, Injectable } from '@nestjs/common';
import type postgres from 'postgres';
import { withTenantContext, type TransactionExecutor } from '@auditforge/tenancy-core';
import { TenancyAdapter } from '../adapters/tenancy.adapter.js';
import { RequestContextStore } from '../common/request-context.js';
import { PG_CLIENT } from './db.module.js';

/**
 * Bridge a postgres-js transaction to tenancy-core's `TransactionExecutor`
 * shape. The package only needs `executeRaw` and `transaction` — both are
 * trivially expressed in terms of the postgres-js tag-template API.
 */
function asTransactionExecutor(tx: postgres.TransactionSql): TransactionExecutor {
  return {
    async executeRaw(sql: string, params: readonly unknown[] = []): Promise<unknown> {
      return tx.unsafe(sql, params as never[]);
    },
    async transaction<T>(fn: (inner: TransactionExecutor) => Promise<T>): Promise<T> {
      // Postgres-js does not expose nested savepoints from a TransactionSql
      // object via the same `begin` API; for now we run the inner fn in the
      // same transaction (effectively a flat tx) and rely on outer rollback.
      // TODO(rls-migration): wire savepoints once Drizzle is the primary
      // transaction executor.
      return fn(asTransactionExecutor(tx));
    },
  };
}

@Injectable()
export class BaseRepository {
  constructor(
    @Inject(PG_CLIENT) protected readonly sql: postgres.Sql,
    protected readonly tenancy: TenancyAdapter,
  ) {}

  /**
   * Run `fn` inside a transaction with RLS session vars set to the current
   * RequestContext. All repository writes/reads should use this wrapper.
   *
   * Concretely: open a postgres-js transaction, hand it to
   * `withTenantContext` from `@auditforge/tenancy-core`, and pass the
   * underlying `TransactionSql` (cast back from the executor wrapper) to the
   * caller so query DSLs work unchanged.
   *
   * TODO(rls-migration): expose the wrapped Drizzle handle here once
   * `packages/db` lands so callers don't need to choose between postgres-js
   * and drizzle.
   */
  protected async withTenant<T>(fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
    const ctx = RequestContextStore.require();
    return (this.sql.begin(async (tx: postgres.TransactionSql) => {
      const exec = asTransactionExecutor(tx);
      return withTenantContext(
        exec,
        {
          firmId: ctx.firmId,
          auditorId: ctx.auditorId,
          ...(ctx.engagementId !== undefined ? { engagementId: ctx.engagementId } : {}),
        },
        async () => {
          if (ctx.engagementId) {
            await tx`SET LOCAL app.current_engagement_id = ${ctx.engagementId}`;
          }
          return fn(tx);
        },
      );
    }) as Promise<T>);
  }
}
