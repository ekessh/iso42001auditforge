// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';

import {
  EngagementService,
  ModeImmutableError,
} from '../src/engagement/service.js';
import { EngagementModeSchema } from '../src/types/engagement.js';
import type { Engagement } from '../src/types/engagement.js';
import type {
  AuditorId,
  ClientId,
  EngagementId,
  FirmId,
} from '@auditforge/shared';

const auditEngagement: Engagement = {
  id: 'eeeeeeee-eeee-4eee-eeee-eeeeeeeeeeee' as unknown as EngagementId,
  firmId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa' as unknown as FirmId,
  clientId: 'dddddddd-dddd-4ddd-dddd-dddddddddddd' as unknown as ClientId,
  mode: 'audit',
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
  leadAuditorId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb' as unknown as AuditorId,
};

const readinessEngagement: Engagement = {
  ...auditEngagement,
  mode: 'readiness',
};

describe('EngagementModeSchema', () => {
  it('accepts the two canonical values', () => {
    expect(EngagementModeSchema.parse('audit')).toBe('audit');
    expect(EngagementModeSchema.parse('readiness')).toBe('readiness');
  });

  it('rejects unknown strings', () => {
    expect(() => EngagementModeSchema.parse('hybrid')).toThrow(TypeError);
    expect(() => EngagementModeSchema.parse('')).toThrow(TypeError);
  });

  it('rejects non-string input', () => {
    expect(() => EngagementModeSchema.parse(null)).toThrow(TypeError);
    expect(() => EngagementModeSchema.parse(undefined)).toThrow(TypeError);
    expect(() => EngagementModeSchema.parse(42)).toThrow(TypeError);
  });

  it('safeParse returns discriminated success/failure', () => {
    const ok = EngagementModeSchema.safeParse('audit');
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data).toBe('audit');

    const bad = EngagementModeSchema.safeParse('xxx');
    expect(bad.success).toBe(false);
  });

  it('exposes the canonical value list', () => {
    expect(EngagementModeSchema.values).toEqual(['audit', 'readiness']);
  });
});

describe('EngagementService.validateForCreate', () => {
  it('passes for valid mode', () => {
    expect(() =>
      EngagementService.validateForCreate({ mode: 'audit' }),
    ).not.toThrow();
    expect(() =>
      EngagementService.validateForCreate({ mode: 'readiness' }),
    ).not.toThrow();
  });

  it('throws for unknown mode coming over the wire', () => {
    expect(() =>
      EngagementService.validateForCreate({
        mode: 'somethingElse' as never,
      }),
    ).toThrow(TypeError);
  });
});

describe('EngagementService.assertMode', () => {
  it('passes when mode matches', () => {
    expect(() =>
      EngagementService.assertMode(auditEngagement, 'audit'),
    ).not.toThrow();
    expect(() =>
      EngagementService.assertMode(readinessEngagement, 'readiness'),
    ).not.toThrow();
  });

  it('throws ConflictError when mode does not match', () => {
    expect(() =>
      EngagementService.assertMode(auditEngagement, 'readiness'),
    ).toThrow(/audit/);
    expect(() =>
      EngagementService.assertMode(readinessEngagement, 'audit'),
    ).toThrow(/readiness/);
  });
});

describe('EngagementService.update — mode immutability', () => {
  it('allows updates to non-mode fields', () => {
    const out = EngagementService.update(auditEngagement, {
      status: 'planned',
    });
    expect(out.status).toBe('planned');
    expect(out.mode).toBe('audit');
  });

  it('allows a no-op update that re-asserts the same mode', () => {
    const patch = { mode: 'audit' as const };
    const out = EngagementService.update(auditEngagement, patch as never);
    expect(out.mode).toBe('audit');
  });

  it('rejects audit -> readiness mutation', () => {
    expect(() =>
      EngagementService.update(
        auditEngagement,
        { mode: 'readiness' } as never,
      ),
    ).toThrow(ModeImmutableError);
  });

  it('rejects readiness -> audit mutation', () => {
    expect(() =>
      EngagementService.update(
        readinessEngagement,
        { mode: 'audit' } as never,
      ),
    ).toThrow(ModeImmutableError);
  });

  it('ModeImmutableError carries 409 + structured details', () => {
    try {
      EngagementService.update(
        auditEngagement,
        { mode: 'readiness' } as never,
      );
      throw new Error('expected ModeImmutableError');
    } catch (e) {
      expect(e).toBeInstanceOf(ModeImmutableError);
      const err = e as ModeImmutableError;
      expect(err.httpStatus).toBe(409);
      expect(err.code).toBe('MODE_IMMUTABLE');
      expect(err.details).toMatchObject({
        fromMode: 'audit',
        toMode: 'readiness',
        engagementId: auditEngagement.id,
      });
    }
  });

  it('strips mode from the patch even when set to current value', () => {
    const out = EngagementService.update(auditEngagement, {
      ...({ mode: 'audit' } as never),
      status: 'planned',
    });
    // Result must still have correct mode, status updated.
    expect(out.mode).toBe('audit');
    expect(out.status).toBe('planned');
  });
});
