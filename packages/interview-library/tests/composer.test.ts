// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { InterviewComposer } from '../src/composer/composer.js';
import { InterviewLibraryLoader } from '../src/loader/loader.js';

const ENG = '00000000-0000-0000-0000-000000000001';

describe('InterviewComposer', () => {
  const loader = InterviewLibraryLoader.loadBundled();
  const composer = new InterviewComposer(loader);

  it('builds a plan that fits inside the time-box', () => {
    const plan = composer.compose({
      engagementId: ENG,
      roles: ['top_management', 'ai_system_owner', 'data_scientist'],
      clauses: [],
      durationMinutes: 30,
      mode: 'audit',
      clauseFocus: {},
    });
    expect(plan.totalDurationMinutes).toBeLessThanOrEqual(30);
    expect(plan.items.length).toBeGreaterThan(0);
  });

  it('only returns role-appropriate questions', () => {
    const plan = composer.compose({
      engagementId: ENG,
      roles: ['data_scientist'],
      clauses: [],
      durationMinutes: 60,
      mode: 'audit',
      clauseFocus: {},
    });
    expect(plan.items.every((i) => i.entry.role === 'data_scientist')).toBe(true);
  });

  it('honors clause focus weights', () => {
    const focused = composer.compose({
      engagementId: ENG,
      roles: ['data_scientist'],
      clauses: [],
      durationMinutes: 15,
      mode: 'audit',
      clauseFocus: { 'A.7.6': 10 },
    });
    expect(focused.items[0]?.entry.clauseRefs.includes('A.7.6')).toBe(true);
  });

  it('produces deterministic output for the same input', () => {
    const a = composer.compose({
      engagementId: ENG,
      roles: ['ai_system_owner'],
      clauses: [],
      durationMinutes: 25,
      mode: 'audit',
      clauseFocus: {},
    });
    const b = composer.compose({
      engagementId: ENG,
      roles: ['ai_system_owner'],
      clauses: [],
      durationMinutes: 25,
      mode: 'audit',
      clauseFocus: {},
    });
    expect(a.items.map((i) => i.entry.id)).toStrictEqual(b.items.map((i) => i.entry.id));
  });

  it('reports clause coverage', () => {
    const plan = composer.compose({
      engagementId: ENG,
      roles: ['ai_system_owner'],
      clauses: [],
      durationMinutes: 30,
      mode: 'audit',
      clauseFocus: {},
    });
    expect(Object.keys(plan.coverage).length).toBeGreaterThan(0);
  });

  it('rejects empty roles list', () => {
    expect(() =>
      composer.compose({
        engagementId: ENG,
        roles: [],
        clauses: [],
        durationMinutes: 30,
        mode: 'audit',
        clauseFocus: {},
      } as never),
    ).toThrowError();
  });

  it('rejects non-positive duration', () => {
    expect(() =>
      composer.compose({
        engagementId: ENG,
        roles: ['top_management'],
        clauses: [],
        durationMinutes: 0,
        mode: 'audit',
        clauseFocus: {},
      } as never),
    ).toThrowError();
  });

  it('respects clause filter when provided', () => {
    const plan = composer.compose({
      engagementId: ENG,
      roles: ['ai_system_owner', 'data_scientist'],
      clauses: ['6.1'],
      durationMinutes: 60,
      mode: 'audit',
      clauseFocus: {},
    });
    for (const item of plan.items) {
      expect(item.entry.clauseRefs.some((c) => c === '6.1')).toBe(true);
    }
  });

  it('returns an empty plan when no candidates fit', () => {
    const plan = composer.compose({
      engagementId: ENG,
      roles: ['top_management'],
      clauses: ['NEVER-MATCH'],
      durationMinutes: 30,
      mode: 'audit',
      clauseFocus: {},
    });
    expect(plan.items.length).toBe(0);
    expect(plan.totalDurationMinutes).toBe(0);
  });
});
