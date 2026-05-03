// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect, beforeEach } from 'vitest';
import { CoAuditorService } from './co-auditor.service.js';
import { CoAuditorRepository } from './co-auditor.repository.js';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { RequestContextStore } from '../../common/request-context.js';

describe('CoAuditorService', () => {
  let svc: CoAuditorService;
  const firmA = '11111111-1111-1111-1111-111111111111';
  const firmB = '22222222-2222-2222-2222-222222222222';

  beforeEach(() => {
    const sql = (() => Promise.resolve()) as unknown as Parameters<typeof Reflect.construct>[1];
    // BaseRepository requires sql + tenancy; in unit tests we skip actual DB
    const repo = new CoAuditorRepository(sql as never, new TenancyAdapter());
    svc = new CoAuditorService(repo);
  });

  function withCtx(firmId: string, fn: () => Promise<unknown>): Promise<unknown> {
    return RequestContextStore.run(
      { requestId: 'r', firmId, auditorId: 'a', roles: ['lead_auditor'] },
      fn,
    );
  }

  it('creates and reads back', async () => {
    await withCtx(firmA, async () => {
      const created = await svc.create(firmA, { name: 'sample' });
      expect(created.firmId).toBe(firmA);
      const got = await svc.get(firmA, created.id);
      expect(got.id).toBe(created.id);
    });
  });

  it('isolates by firm', async () => {
    let id = '';
    await withCtx(firmA, async () => {
      const r = await svc.create(firmA, { name: 'a' });
      id = r.id;
    });
    await withCtx(firmB, async () => {
      await expect(svc.get(firmB, id)).rejects.toThrow();
    });
  });

  it('updates fields', async () => {
    await withCtx(firmA, async () => {
      const c = await svc.create(firmA, { name: 'old' });
      const u = await svc.update(firmA, c.id, { name: 'new' });
      expect(u.name).toBe('new');
    });
  });

  it('lists with pagination', async () => {
    await withCtx(firmA, async () => {
      for (let i = 0; i < 3; i += 1) await svc.create(firmA, { name: 'i' + i });
      const page = await svc.list(firmA, { limit: 2 });
      expect(page.items.length).toBe(2);
    });
  });

  it('removes', async () => {
    await withCtx(firmA, async () => {
      const c = await svc.create(firmA, { name: 'gone' });
      await svc.remove(firmA, c.id);
      await expect(svc.get(firmA, c.id)).rejects.toThrow();
    });
  });
});
