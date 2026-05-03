// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it, vi } from 'vitest';
import { TenantViolation } from '@auditforge/shared';
import {
  assertEngagementBelongsToFirm,
  assertSameFirm,
  tenantGuard,
  withTenantContext,
  type TransactionExecutor,
} from '../src/context.js';

const FIRM_A = '11111111-1111-1111-1111-111111111111';
const FIRM_B = '22222222-2222-2222-2222-222222222222';
const AUD_1 = '33333333-3333-3333-3333-333333333333';

class MockExecutor implements TransactionExecutor {
  public readonly calls: Array<{ sql: string; params?: readonly unknown[] }> = [];

  async executeRaw(sql: string, params?: readonly unknown[]): Promise<unknown> {
    this.calls.push({ sql, params });
    return undefined;
  }

  async transaction<T>(fn: (tx: TransactionExecutor) => Promise<T>): Promise<T> {
    this.calls.push({ sql: 'BEGIN' });
    try {
      const r = await fn(this);
      this.calls.push({ sql: 'COMMIT' });
      return r;
    } catch (e) {
      this.calls.push({ sql: 'ROLLBACK' });
      throw e;
    }
  }
}

describe('tenancy-core', () => {
  it('withTenantContext sets and clears session vars in a transaction', async () => {
    const ex = new MockExecutor();
    const result = await withTenantContext(ex, { firmId: FIRM_A, auditorId: AUD_1 }, async () => 42);
    expect(result).toBe(42);
    const sqls = ex.calls.map((c) => c.sql);
    expect(sqls).toContain('BEGIN');
    expect(sqls.some((s) => s.includes('set_tenant_context'))).toBe(true);
    expect(sqls.some((s) => s.includes('clear_tenant_context'))).toBe(true);
    expect(sqls).toContain('COMMIT');
  });

  it('withTenantContext rejects invalid firm UUID', async () => {
    const ex = new MockExecutor();
    await expect(
      withTenantContext(ex, { firmId: 'not-a-uuid' }, async () => 1),
    ).rejects.toThrow();
  });

  it('withTenantContext clears session even when fn throws', async () => {
    const ex = new MockExecutor();
    await expect(
      withTenantContext(ex, { firmId: FIRM_A }, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const sqls = ex.calls.map((c) => c.sql);
    expect(sqls.some((s) => s.includes('clear_tenant_context'))).toBe(true);
    expect(sqls).toContain('ROLLBACK');
  });

  it('tenantGuard accepts matching firm', () => {
    expect(() => tenantGuard({ firmId: FIRM_A }, FIRM_A)).not.toThrow();
  });

  it('tenantGuard rejects cross-firm access', () => {
    expect(() => tenantGuard({ firmId: FIRM_A }, FIRM_B)).toThrow(TenantViolation);
  });

  it('tenantGuard rejects missing firm context', () => {
    expect(() => tenantGuard({ firmId: '' }, FIRM_A)).toThrow(TenantViolation);
  });

  it('assertSameFirm passes when all rows share firm', () => {
    expect(() => assertSameFirm({ firmId: FIRM_A }, { firmId: FIRM_A })).not.toThrow();
  });

  it('assertSameFirm rejects mixed firms', () => {
    expect(() => assertSameFirm({ firmId: FIRM_A }, { firmId: FIRM_B })).toThrow(TenantViolation);
  });

  it('assertSameFirm noop on empty list', () => {
    expect(() => assertSameFirm()).not.toThrow();
  });

  it('assertEngagementBelongsToFirm enforces firm match', () => {
    expect(() => assertEngagementBelongsToFirm({ firmId: FIRM_A }, FIRM_A)).not.toThrow();
    expect(() => assertEngagementBelongsToFirm({ firmId: FIRM_A }, FIRM_B)).toThrow(TenantViolation);
  });

  it('withTenantContext can run without auditorId (firm-only context)', async () => {
    const ex = new MockExecutor();
    await withTenantContext(ex, { firmId: FIRM_A }, async () => 1);
    const setCall = ex.calls.find((c) => c.sql.includes('set_tenant_context'));
    expect(setCall?.params?.[1]).toBeNull();
  });

  it('withTenantContext does not catch fn rejection (caller handles)', async () => {
    const ex = new MockExecutor();
    const spy = vi.fn();
    await expect(
      withTenantContext(ex, { firmId: FIRM_A }, async () => {
        spy();
        throw new Error('downstream');
      }),
    ).rejects.toThrow('downstream');
    expect(spy).toHaveBeenCalledOnce();
  });
});
