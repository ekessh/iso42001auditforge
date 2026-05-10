// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { InterviewsService } from './interviews.service.js';
import { InterviewsRepository } from './interviews.repository.js';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';

const ENG = '00000000-0000-0000-0000-000000000001';

function makeService(): InterviewsService {
  const sql = (() => Promise.resolve()) as unknown as Parameters<typeof Reflect.construct>[1];
  const repo = new InterviewsRepository(sql as never, new TenancyAdapter());
  return new InterviewsService(repo);
}

describe('InterviewsService library/composer', () => {
  it('lists library entries unfiltered', () => {
    const svc = makeService();
    const items = svc.listLibrary({});
    expect(items.length).toBeGreaterThan(0);
  });

  it('filters by role', () => {
    const svc = makeService();
    const items = svc.listLibrary({ roles: ['data_scientist'] });
    expect(items.every((e) => e.role === 'data_scientist')).toBe(true);
  });

  it('composes a plan within the time-box', () => {
    const svc = makeService();
    const plan = svc.compose({
      engagementId: ENG,
      roles: ['top_management', 'ai_system_owner'],
      clauses: [],
      durationMinutes: 30,
      mode: 'audit',
      clauseFocus: {},
    });
    expect(plan.totalDurationMinutes).toBeLessThanOrEqual(30);
    expect(plan.items.length).toBeGreaterThan(0);
  });

  it('returns deterministic plan output', () => {
    const svc = makeService();
    const a = svc.compose({
      engagementId: ENG,
      roles: ['ai_system_owner'],
      clauses: [],
      durationMinutes: 25,
      mode: 'audit',
      clauseFocus: {},
    });
    const b = svc.compose({
      engagementId: ENG,
      roles: ['ai_system_owner'],
      clauses: [],
      durationMinutes: 25,
      mode: 'audit',
      clauseFocus: {},
    });
    expect(a.items.map((i) => i.entry.id)).toStrictEqual(b.items.map((i) => i.entry.id));
  });
});
