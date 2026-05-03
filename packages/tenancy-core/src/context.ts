// SPDX-License-Identifier: BUSL-1.1
import { TenantContextSchema, TenantViolation, type TenantContext } from '@auditforge/shared';

export type TenantSessionVars = Readonly<{
  firmId: string;
  auditorId: string | null;
}>;

export interface TransactionExecutor {
  executeRaw(sql: string, params?: readonly unknown[]): Promise<unknown>;
  transaction<T>(fn: (tx: TransactionExecutor) => Promise<T>): Promise<T>;
}

export async function withTenantContext<T>(
  executor: TransactionExecutor,
  ctx: TenantContext,
  fn: (tx: TransactionExecutor) => Promise<T>,
): Promise<T> {
  const parsed = TenantContextSchema.parse(ctx);
  return executor.transaction(async (tx) => {
    await tx.executeRaw('SELECT set_tenant_context($1::uuid, $2::uuid)', [
      parsed.firmId,
      parsed.auditorId ?? null,
    ]);
    try {
      return await fn(tx);
    } finally {
      await tx.executeRaw('SELECT clear_tenant_context()').catch(() => undefined);
    }
  });
}

export interface RequestLikeContext {
  readonly firmId: string;
  readonly auditorId?: string;
  readonly engagementId?: string;
}

export function tenantGuard(req: RequestLikeContext, requestedFirmId: string): void {
  if (!req.firmId) {
    throw new TenantViolation('Missing tenant context on request');
  }
  if (req.firmId !== requestedFirmId) {
    throw new TenantViolation('Cross-firm access denied', {
      sessionFirm: req.firmId,
      requestedFirm: requestedFirmId,
    });
  }
}

export interface FirmOwned {
  readonly firmId: string;
}

export function assertSameFirm(...rows: readonly FirmOwned[]): void {
  if (rows.length === 0) return;
  const expected = rows[0]!.firmId;
  for (const r of rows) {
    if (r.firmId !== expected) {
      throw new TenantViolation('Cross-firm row join detected', {
        firms: Array.from(new Set(rows.map((row) => row.firmId))),
      });
    }
  }
}

export function assertEngagementBelongsToFirm(
  engagement: { firmId: string },
  expectedFirmId: string,
): void {
  if (engagement.firmId !== expectedFirmId) {
    throw new TenantViolation('Engagement does not belong to firm', {
      engagementFirm: engagement.firmId,
      expectedFirm: expectedFirmId,
    });
  }
}
