// SPDX-License-Identifier: BUSL-1.1
import { Inject, Injectable } from '@nestjs/common';
import type postgres from 'postgres';
import { TenancyAdapter } from '../adapters/tenancy.adapter.js';
import { RequestContextStore } from '../common/request-context.js';
import { PG_CLIENT } from './db.module.js';

@Injectable()
export class BaseRepository {
  constructor(
    @Inject(PG_CLIENT) protected readonly sql: postgres.Sql,
    protected readonly tenancy: TenancyAdapter,
  ) {}

  /**
   * Run `fn` inside a transaction with RLS session vars set to the current
   * RequestContext. All repository writes/reads should use this wrapper.
   */
  protected async withTenant<T>(fn: (tx: postgres.TransactionSql) => Promise<T>): Promise<T> {
    const ctx = RequestContextStore.require();
    return this.sql.begin(async (tx) => {
      await tx`SET LOCAL app.current_firm_id = ${ctx.firmId}`;
      await tx`SET LOCAL app.current_auditor_id = ${ctx.auditorId}`;
      if (ctx.engagementId) {
        await tx`SET LOCAL app.current_engagement_id = ${ctx.engagementId}`;
      }
      return fn(tx);
    });
  }
}
