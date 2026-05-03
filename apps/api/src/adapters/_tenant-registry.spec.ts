// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect } from 'vitest';
import { TenantScopedRegistry } from './_tenant-registry.js';

interface Row {
  readonly id: string;
  readonly firmId: string;
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

const auditStub = { append: async () => ({ id: 'evt' } as never) };

const FIRM_A = '11111111-1111-1111-1111-111111111111';
const FIRM_B = '22222222-2222-2222-2222-222222222222';

function makeRegistry(): TenantScopedRegistry<Row, { name: string }, { name?: string }> {
  return new TenantScopedRegistry<Row, { name: string }, { name?: string }>(
    { entity: 'thing' },
    auditStub as never,
    (firmId, dto, base) => ({
      id: base.id,
      firmId,
      name: dto.name,
      createdAt: base.createdAt,
      updatedAt: base.updatedAt,
    }),
    (current, dto, updatedAt) => ({ ...current, ...dto, updatedAt }) as Row,
    'Thing',
  );
}

describe('TenantScopedRegistry', () => {
  it('creates and retrieves rows with tenant scoping', async () => {
    const reg = makeRegistry();
    const r = await reg.create(FIRM_A, { name: 'a' });
    expect(r.firmId).toBe(FIRM_A);
    await expect(reg.findById(FIRM_B, r.id)).rejects.toThrow();
    const fetched = await reg.findById(FIRM_A, r.id);
    expect(fetched.name).toBe('a');
  });

  it('paginates with cursor', async () => {
    const reg = makeRegistry();
    for (let i = 0; i < 5; i++) {
      await reg.create(FIRM_A, { name: `n-${i}` });
      // Ensure distinct createdAt timestamps so the stable sort is unambiguous.
      await new Promise((r) => setTimeout(r, 1));
    }
    const page1 = await reg.list(FIRM_A, { limit: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();
    const page2 = await reg.list(FIRM_A, { limit: 2, cursor: page1.nextCursor! });
    expect(page2.items).toHaveLength(2);
    expect(page2.items[0]!.id).not.toBe(page1.items[0]!.id);
  });

  it('updates and removes rows', async () => {
    const reg = makeRegistry();
    const r = await reg.create(FIRM_A, { name: 'x' });
    const u = await reg.update(FIRM_A, r.id, { name: 'y' });
    expect(u.name).toBe('y');
    await reg.remove(FIRM_A, r.id);
    await expect(reg.findById(FIRM_A, r.id)).rejects.toThrow();
  });

  it('isolates between firms in list()', async () => {
    const reg = makeRegistry();
    await reg.create(FIRM_A, { name: 'a' });
    await reg.create(FIRM_B, { name: 'b' });
    const pageA = await reg.list(FIRM_A, { limit: 10 });
    expect(pageA.items).toHaveLength(1);
    expect(pageA.items[0]!.firmId).toBe(FIRM_A);
  });
});
