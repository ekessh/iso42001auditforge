// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect, beforeEach } from 'vitest';

import { EngagementService } from '../src/engagement/service.js';
import { auditEventKindKey } from '../src/types/audit-event.js';
import { InMemoryLedger, type TenantContext } from '../src/ports.js';
import type {
  AuditorId,
  ClientId,
  EngagementId,
  FirmId,
} from '@auditforge/shared';
import type { Engagement } from '../src/types/engagement.js';

const tenant: TenantContext = {
  firmId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa' as unknown as FirmId,
  auditorId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb' as unknown as AuditorId,
  engagementId: 'cccccccc-cccc-4ccc-cccc-cccccccccccc' as unknown as EngagementId,
};

const baseEngagement: Engagement = {
  id: tenant.engagementId,
  firmId: tenant.firmId,
  clientId: 'dddddddd-dddd-4ddd-dddd-dddddddddddd' as unknown as ClientId,
  scope: {
    aimsScopeStatement: 'Test',
    useCaseCount: 1,
    modelCount: 1,
    agentCount: 0,
    siteCount: 1,
    complexity: 'medium',
    integratedManagementSystems: [],
    virtualAuditPercentage: 0,
  },
  lifecycleStage: 'S1',
  startDate: '2026-05-01',
  endDate: '2026-05-08',
  status: 'draft',
  leadAuditorId: tenant.auditorId,
};

let ledger: InMemoryLedger;
let svc: EngagementService;
beforeEach(() => {
  ledger = new InMemoryLedger();
  svc = new EngagementService(ledger);
});

describe('EngagementService — status transitions', () => {
  it('allows draft -> planned', async () => {
    const eng = await svc.transitionStatus(tenant, baseEngagement, 'planned');
    expect(eng.status).toBe('planned');
    expect(ledger.byType('engagement.status_changed')).toHaveLength(1);
  });

  it('rejects illegal transitions', async () => {
    await expect(
      svc.transitionStatus(tenant, baseEngagement, 'closed'),
    ).rejects.toThrow();
  });

  it('closed and withdrawn are terminal', () => {
    expect(EngagementService.canTransitionStatus('closed', 'planned')).toBe(false);
    expect(EngagementService.canTransitionStatus('withdrawn', 'planned')).toBe(false);
  });

  it('same-status transition is allowed (no-op)', () => {
    expect(EngagementService.canTransitionStatus('draft', 'draft')).toBe(true);
  });
});

describe('EngagementService — lifecycle stage transitions', () => {
  it('S1 -> S2 -> Surv1 -> Surv2 -> Recert valid', () => {
    expect(EngagementService.canTransitionStage('S1', 'S2')).toBe(true);
    expect(EngagementService.canTransitionStage('S2', 'Surv1')).toBe(true);
    expect(EngagementService.canTransitionStage('Surv1', 'Surv2')).toBe(true);
    expect(EngagementService.canTransitionStage('Surv2', 'Recert')).toBe(true);
  });

  it('rejects skipping stages (e.g. S1 -> Recert)', () => {
    expect(EngagementService.canTransitionStage('S1', 'Recert')).toBe(false);
  });

  it('Recert -> Surv1 starts a new cycle', () => {
    expect(EngagementService.canTransitionStage('Recert', 'Surv1')).toBe(true);
  });

  it('Special can fan out to any other stage', () => {
    for (const target of ['S1', 'S2', 'Surv1', 'Surv2', 'Recert'] as const) {
      expect(EngagementService.canTransitionStage('Special', target)).toBe(true);
    }
  });

  it('transitionStage emits a ledger event', async () => {
    const eng = await svc.transitionStage(tenant, baseEngagement, 'S2');
    expect(eng.lifecycleStage).toBe('S2');
    expect(ledger.byType('engagement.stage_changed')).toHaveLength(1);
  });
});

describe('EngagementService.assertConsistent', () => {
  it('rejects inverted date windows', () => {
    expect(() =>
      EngagementService.assertConsistent({
        ...baseEngagement,
        startDate: '2026-12-01',
        endDate: '2026-01-01',
      }),
    ).toThrow();
  });

  it('accepts same start and end date', () => {
    expect(() =>
      EngagementService.assertConsistent({
        ...baseEngagement,
        startDate: '2026-05-01',
        endDate: '2026-05-01',
      }),
    ).not.toThrow();
  });
});

describe('auditEventKindKey', () => {
  it('produces stable keys for every kind', () => {
    expect(auditEventKindKey({ kind: 'Stage1' })).toBe('Stage1');
    expect(auditEventKindKey({ kind: 'Stage2' })).toBe('Stage2');
    expect(auditEventKindKey({ kind: 'Surveillance', index: 1 })).toBe('Surveillance#1');
    expect(auditEventKindKey({ kind: 'Surveillance', index: 2 })).toBe('Surveillance#2');
    expect(auditEventKindKey({ kind: 'Recert' })).toBe('Recert');
    expect(
      auditEventKindKey({ kind: 'Special', subtype: 'witnessed' }),
    ).toBe('Special#witnessed');
  });
});
