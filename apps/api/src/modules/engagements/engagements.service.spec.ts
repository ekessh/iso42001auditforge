// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect, beforeEach } from 'vitest';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { EngagementsRepository } from './engagements.repository.js';
import { EngagementsService } from './engagements.service.js';
import type { CreateEngagementDto } from './dto.js';

const firm = '11111111-1111-1111-1111-111111111111';
const otherFirm = '22222222-2222-2222-2222-222222222222';
const baseDto: CreateEngagementDto = {
  clientId: '33333333-3333-3333-3333-333333333333',
  stage: 'stage1',
  scopeStatement: 'AIMS coverage scope',
  startsOn: '2026-06-01',
  endsOn: '2026-06-05',
  leadAuditorId: '44444444-4444-4444-4444-444444444444',
  teamMemberIds: [],
};

describe('EngagementsService', () => {
  let svc: EngagementsService;

  beforeEach(() => {
    const repo = new EngagementsRepository({} as never, new TenancyAdapter());
    svc = new EngagementsService(repo);
  });

  it('creates an engagement in planned status', async () => {
    const e = await svc.create(firm, baseDto);
    expect(e.status).toBe('planned');
    expect(e.stage).toBe('stage1');
  });

  it('rejects endsOn before startsOn', async () => {
    await expect(svc.create(firm, { ...baseDto, endsOn: '2026-05-01' })).rejects.toThrow();
  });

  it('isolates engagements between firms', async () => {
    const e = await svc.create(firm, baseDto);
    await expect(svc.get(otherFirm, e.id)).rejects.toThrow();
  });

  it('honours allowed transitions', async () => {
    const e = await svc.create(firm, baseDto);
    const t1 = await svc.transition(firm, e.id, { to: 'in_progress' });
    expect(t1.status).toBe('in_progress');
    const t2 = await svc.transition(firm, e.id, { to: 'reporting' });
    expect(t2.status).toBe('reporting');
  });

  it('rejects illegal transitions', async () => {
    const e = await svc.create(firm, baseDto);
    await expect(svc.transition(firm, e.id, { to: 'issued' })).rejects.toThrow();
  });

  it('lists with pagination', async () => {
    for (let i = 0; i < 3; i += 1) await svc.create(firm, baseDto);
    const page = await svc.list(firm, { limit: 2 });
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).not.toBeNull();
  });
});
