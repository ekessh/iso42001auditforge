// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { InterviewLibraryLoader } from '../src/loader/loader.js';

describe('InterviewLibraryLoader', () => {
  it('loads the bundled catalogue', () => {
    const loader = InterviewLibraryLoader.loadBundled();
    expect(loader.list().length).toBeGreaterThan(10);
  });

  it('rejects duplicates', () => {
    expect(() =>
      InterviewLibraryLoader.fromArray([
        {
          id: 'X-1',
          role: 'top_management',
          clauseRefs: ['5.1'],
          applicableModes: ['audit'],
          aiSystemClasses: ['any'],
          question: 'Q?',
          followUps: [],
          evidenceToSeek: [],
          commonPitfalls: [],
          timeBoxMinutes: 5,
        },
        {
          id: 'X-1',
          role: 'top_management',
          clauseRefs: ['5.1'],
          applicableModes: ['audit'],
          aiSystemClasses: ['any'],
          question: 'Q?',
          followUps: [],
          evidenceToSeek: [],
          commonPitfalls: [],
          timeBoxMinutes: 5,
        },
      ]),
    ).toThrowError(/Duplicate/);
  });

  it('rejects schema violations', () => {
    expect(() =>
      InterviewLibraryLoader.fromArray([{ id: 'bad' }]),
    ).toThrowError(/failed validation/);
  });

  it('indexes by role and clause', () => {
    const loader = InterviewLibraryLoader.loadBundled();
    expect(loader.byRoleList('top_management').length).toBeGreaterThan(0);
    expect(loader.byClauseList('5.1').length).toBeGreaterThan(0);
  });

  it('filters by combined criteria', () => {
    const loader = InterviewLibraryLoader.loadBundled();
    const subset = loader.filter({
      roles: ['data_scientist'],
      clauses: ['A.7.4', 'A.7.5'],
      modes: ['audit'],
    });
    expect(subset.length).toBeGreaterThan(0);
    expect(subset.every((e) => e.role === 'data_scientist')).toBe(true);
  });

  it('produces an indexable projection', () => {
    const loader = InterviewLibraryLoader.loadBundled();
    const idx = loader.indexable();
    expect(idx.length).toBe(loader.list().length);
    for (const i of idx) {
      expect(i.text.length).toBeGreaterThan(0);
      expect(i.clauseRefs.length).toBeGreaterThan(0);
    }
  });

  it('returns undefined for missing id', () => {
    const loader = InterviewLibraryLoader.loadBundled();
    expect(loader.getById('NOPE')).toBeUndefined();
  });
});
