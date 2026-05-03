// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { ProbesRepository } from './probes.repository.js';
import { ProbesService } from './probes.service.js';
import type { AppConfig } from '../../config/config.schema.js';

const firm = '11111111-1111-1111-1111-111111111111';
const eng = '99999999-9999-9999-9999-999999999999';

describe('ProbesService', () => {
  let svc: ProbesService;
  let added: number;

  beforeEach(() => {
    added = 0;
    const repo = new ProbesRepository({} as never, new TenancyAdapter());
    const cfg = { PROBE_BUDGET_DEFAULT_USD: 100, AGENT_ALLOWED_HOSTS: 'inference.example.com' } as AppConfig;
    const queue = { add: vi.fn(async () => { added += 1; return { id: 'p-1' }; }) } as unknown as ConstructorParameters<typeof ProbesService>[2];
    svc = new ProbesService(repo, cfg, queue);
  });

  it('creates a probe definition', async () => {
    const p = await svc.createDefinition(firm, { name: 'p1', category: 'safety', mode: 'offline', spec: {}, budgetUsd: 0, cpuMs: 1_000, memMb: 256 });
    expect(p.firmId).toBe(firm);
  });

  it('queues an execution', async () => {
    const p = await svc.createDefinition(firm, { name: 'p2', category: 'safety', mode: 'live', spec: {}, budgetUsd: 1, cpuMs: 1_000, memMb: 256 });
    const ex = await svc.execute(firm, p.id, { engagementId: eng, parameters: {} });
    expect(ex.status).toBe('queued');
    expect(added).toBe(1);
  });

  it('rejects execution that would exceed budget allowance', async () => {
    const p = await svc.createDefinition(firm, { name: 'p3', category: 'safety', mode: 'live', spec: {}, budgetUsd: 1_000, cpuMs: 1_000, memMb: 256 });
    await expect(svc.execute(firm, p.id, { engagementId: eng, parameters: {} })).rejects.toThrow();
  });

  it('returns budget summary', async () => {
    const s = await svc.budgetSummary(firm, eng);
    expect(s.allowance).toBe(100);
    expect(s.remaining).toBe(100);
  });
});
