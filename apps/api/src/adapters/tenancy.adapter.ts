// SPDX-License-Identifier: BUSL-1.1
// TODO(phase-1): replace with packages/tenancy-core when available.
// Sets per-request RLS session variables on a Postgres connection.

import { Injectable, Logger } from '@nestjs/common';

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

  async applyContext(conn: RlsSetter, ctx: TenantContext): Promise<void> {
    await conn.query(`SET LOCAL app.current_firm_id = $1`, [ctx.firmId]);
    await conn.query(`SET LOCAL app.current_auditor_id = $1`, [ctx.auditorId]);
    if (ctx.engagementId) {
      await conn.query(`SET LOCAL app.current_engagement_id = $1`, [ctx.engagementId]);
    }
  }

  async clearContext(conn: RlsSetter): Promise<void> {
    await conn.query(`RESET app.current_firm_id`);
    await conn.query(`RESET app.current_auditor_id`);
    await conn.query(`RESET app.current_engagement_id`);
  }
}
