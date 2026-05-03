// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect, beforeEach } from 'vitest';
import { AuditEngineAdapter } from './audit-engine.adapter.js';
import { EngagementAdapter } from './engagement.adapter.js';
import type { CreateEngagementDto, UpdateEngagementDto } from '../modules/engagements/dto.js';

const FIRM = '11111111-1111-1111-1111-111111111111';

const baseDto: CreateEngagementDto = {
  clientId: '33333333-3333-3333-3333-333333333333',
  mode: 'audit',
  stage: 'stage1',
  scopeStatement: 'AIMS scope',
  startsOn: '2026-06-01',
  endsOn: '2026-06-05',
  leadAuditorId: '44444444-4444-4444-4444-444444444444',
  teamMemberIds: [],
};

describe('EngagementAdapter', () => {
  let adapter: EngagementAdapter;

  beforeEach(() => {
    adapter = new EngagementAdapter(new AuditEngineAdapter());
  });

  it('creates an engagement via the registry', async () => {
    const e = await adapter.registry.create(FIRM, baseDto);
    expect(e.firmId).toBe(FIRM);
    expect(e.mode).toBe('audit');
    expect(e.status).toBe('planned');
  });

  it('rejects mode-changing updates via assertModeImmutable', () => {
    expect(() =>
      adapter.assertModeImmutable(
        { ...baseDto, id: 'x', firmId: FIRM, mode: 'audit', status: 'planned', createdAt: '', updatedAt: '' } as never,
        { mode: 'readiness' } as UpdateEngagementDto,
      ),
    ).toThrow();
  });

  it('exposes calculateProgramme, buildPlan, detectPlanConflicts', () => {
    expect(typeof adapter.programme.calculate).toBe('function');
    expect(typeof adapter.plan.build).toBe('function');
    expect(typeof adapter.plan.detectConflicts).toBe('function');
  });

  it('isolates engagements between firms via registry guard', async () => {
    const e = await adapter.registry.create(FIRM, baseDto);
    const otherFirm = '22222222-2222-2222-2222-222222222222';
    await expect(adapter.registry.findById(otherFirm, e.id)).rejects.toThrow();
  });
});
