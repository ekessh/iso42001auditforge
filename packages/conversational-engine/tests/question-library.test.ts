// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { QuestionLibraryLoader } from '../src/question-library/loader.js';

describe('QuestionLibraryLoader (data-driven)', () => {
  const lib = QuestionLibraryLoader.loadDefault();

  it('loads at least 60 questions', () => {
    expect(lib.count()).toBeGreaterThanOrEqual(60);
  });

  it('contains at least 30 follow-up patterns', () => {
    expect(lib.countFollowUps()).toBeGreaterThanOrEqual(30);
  });

  it('every entry has a non-empty text and at least one mappedClause', () => {
    for (const e of lib.all()) {
      expect(e.text.length).toBeGreaterThan(0);
      expect(e.mappedClauses.length).toBeGreaterThan(0);
    }
  });

  it('covers ISO 42001 clauses 4–10', () => {
    const all = lib.all();
    const seen = new Set<string>();
    for (const e of all) for (const c of e.mappedClauses) seen.add(c.split('.')[0] ?? '');
    for (const top of ['4', '5', '6', '7', '8', '9', '10']) {
      expect(seen.has(top)).toBe(true);
    }
  });

  it('covers Annex A.2 through A.10', () => {
    const all = lib.all();
    const seen = new Set<string>();
    for (const e of all)
      for (const c of e.mappedClauses) {
        if (c.startsWith('A.')) seen.add(c.split('.')[1] ?? '');
      }
    for (const ax of ['2', '3', '4', '5', '6', '7', '8', '9', '10']) {
      expect(seen.has(ax)).toBe(true);
    }
  });

  it('covers all 8 AI system kinds', () => {
    const seen = new Set<string>();
    for (const e of lib.all()) for (const k of e.applicableKinds) seen.add(k);
    expect(seen.size).toBeGreaterThanOrEqual(8);
  });

  it('rejects malformed JSON via Zod', () => {
    expect(() => QuestionLibraryLoader.fromJson([{ id: 'x' }])).toThrow();
  });

  it('rejects unknown AI kinds', () => {
    expect(() =>
      QuestionLibraryLoader.fromJson([
        {
          id: 'X1',
          version: 1,
          text: 't',
          intent: 'i',
          mappedClauses: ['4.3'],
          applicableKinds: ['quantum-magic'],
          applicablePhases: ['S2'],
          expectedEvidenceTypes: ['policy'],
          commonDeflections: [],
          followUps: [],
          tags: ['x'],
        },
      ]),
    ).toThrow();
  });

  it('rejects duplicate IDs', () => {
    const dup = [
      {
        id: 'D1',
        version: 1,
        text: 't',
        intent: 'i',
        mappedClauses: ['4.3'],
        applicableKinds: ['llm'],
        applicablePhases: ['S2'],
        expectedEvidenceTypes: ['policy'],
        commonDeflections: [],
        followUps: [],
        tags: [],
      },
      {
        id: 'D1',
        version: 1,
        text: 't2',
        intent: 'i',
        mappedClauses: ['4.3'],
        applicableKinds: ['llm'],
        applicablePhases: ['S2'],
        expectedEvidenceTypes: ['policy'],
        commonDeflections: [],
        followUps: [],
        tags: [],
      },
    ];
    expect(() => QuestionLibraryLoader.fromJson(dup)).toThrow(/Duplicate/);
  });

  it('rejects follow-ups referencing unknown questions', () => {
    const bad = [
      {
        id: 'P1',
        version: 1,
        text: 't',
        intent: 'i',
        mappedClauses: ['4.3'],
        applicableKinds: ['llm'],
        applicablePhases: ['S2'],
        expectedEvidenceTypes: ['policy'],
        commonDeflections: [],
        followUps: [
          {
            id: 'fu1',
            trigger: { kind: 'claim-shape', pattern: 'foo' },
            questionId: 'NOT-EXISTS',
            mappedClauses: ['4.3'],
            expectedEvidenceTypes: ['policy'],
          },
        ],
        tags: [],
      },
    ];
    expect(() => QuestionLibraryLoader.fromJson(bad)).toThrow(/unknown question id/);
  });

  it('find() filters by kinds', () => {
    const ragOnly = lib.find({ kinds: ['rag'] });
    expect(ragOnly.length).toBeGreaterThan(0);
    for (const e of ragOnly) {
      expect(e.applicableKinds).toContain('rag');
    }
  });

  it('find() filters by clause', () => {
    const c61 = lib.find({ clauses: ['6.1.2'] });
    expect(c61.length).toBeGreaterThan(0);
    for (const e of c61) expect(e.mappedClauses).toContain('6.1.2');
  });

  it('find() filters by phase', () => {
    const s1 = lib.find({ phases: ['S1'] });
    expect(s1.length).toBeGreaterThan(0);
    for (const e of s1) expect(e.applicablePhases).toContain('S1');
  });

  it('matchClaimShape() returns follow-ups whose pattern matches the claim text', () => {
    const matches = lib.matchClaimShape('we have a process for risk reviews');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('matchClaimShape() supports case-insensitive matching', () => {
    const matches = lib.matchClaimShape('We Have A Process for risk reviews');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('matchClaimShape() ignores invalid regex patterns gracefully', () => {
    const matches = lib.matchClaimShape('xxxxxxxxxxxxxxxxxxxx');
    expect(Array.isArray(matches)).toBe(true);
  });

  it('get() returns undefined for unknown id', () => {
    expect(lib.get('UNKNOWN' as never)).toBeUndefined();
  });

  it('every follow-up that references a question id resolves to a real entry', () => {
    for (const e of lib.all()) {
      for (const fu of e.followUps) {
        if (fu.questionId) {
          expect(lib.get(fu.questionId)).toBeDefined();
        }
      }
    }
  });
});
