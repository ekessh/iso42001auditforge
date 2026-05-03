// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { QuestionGenerator } from '../src/question-generator/generator.js';
import { resolveScope } from '../src/question-generator/scope-resolver.js';
import { prioritize } from '../src/question-generator/prioritizer.js';
import { QuestionLibraryLoader } from '../src/question-library/loader.js';
import type { CoverageState } from '../src/types/domain.js';
import { asClauseId } from '../src/types/ids.js';
import type { QuestionLibraryId } from '../src/types/ids.js';
import { ENGAGEMENT, FIRM, makeArea, makeProfile } from './fixtures.js';

const lib = QuestionLibraryLoader.loadDefault();

const allowAll = {
  isAlreadyAsked: () => false,
  isAlreadyAnswered: () => false,
};

let idCounter = 0;
const stableIds = () => `qsug-test-${++idCounter}`;

describe('resolveScope', () => {
  it('produces deterministic, sorted output', () => {
    const a = resolveScope({
      profile: makeProfile(),
      phase: 'S2',
      area: makeArea(['6.1.2', '6.1.4']),
    });
    const b = resolveScope({
      profile: makeProfile(),
      phase: 'S2',
      area: makeArea(['6.1.4', '6.1.2']),
    });
    expect(a).toEqual(b);
    expect([...a.tags]).toEqual([...a.tags].sort());
    expect([...a.clauses]).toEqual([...a.clauses].sort());
  });

  it('includes phase and kind tags', () => {
    const r = resolveScope({
      profile: makeProfile(),
      phase: 'S2',
      area: makeArea(),
    });
    expect(r.tags).toContain('phase:S2');
    expect(r.tags).toContain('kind:llm');
  });
});

describe('prioritize', () => {
  it('boosts low-coverage clauses over evidenced clauses', () => {
    const a = lib.get('Q-CL6-001' as never)!;
    const b = lib.get('Q-LLM-001' as never)!;
    const ranked = prioritize({
      entries: [a, b],
      coverage: new Map<string, CoverageState>([
        [
          'A.6.2.5',
          {
            firmId: FIRM,
            engagementId: ENGAGEMENT,
            clauseId: asClauseId('A.6.2.5'),
            status: 'evidenced',
            confidence: 1,
            lastUpdate: 'now',
            lastClaimIds: [],
          },
        ],
        [
          'A.9.4',
          {
            firmId: FIRM,
            engagementId: ENGAGEMENT,
            clauseId: asClauseId('A.9.4'),
            status: 'evidenced',
            confidence: 1,
            lastUpdate: 'now',
            lastClaimIds: [],
          },
        ],
      ]),
      mandatoryClauses: new Set(),
      currentPhaseRequiredClauses: new Set(),
    });
    expect(ranked[0]!.entry.id).toBe(a.id);
  });

  it('mandatory clauses receive an extra boost', () => {
    const entries = lib.find({ clauses: ['9.1'] });
    const a = prioritize({
      entries,
      coverage: new Map(),
      mandatoryClauses: new Set(['9.1']),
      currentPhaseRequiredClauses: new Set(),
    });
    const b = prioritize({
      entries,
      coverage: new Map(),
      mandatoryClauses: new Set(),
      currentPhaseRequiredClauses: new Set(),
    });
    expect(a[0]!.score).toBeGreaterThan(b[0]!.score);
    expect(a[0]!.rationale).toContain('mandatory-clause');
  });

  it('phase-required clauses receive an additional boost', () => {
    const entries = lib.find({ clauses: ['9.3'] });
    const ranked = prioritize({
      entries,
      coverage: new Map(),
      mandatoryClauses: new Set(),
      currentPhaseRequiredClauses: new Set(['9.3']),
    });
    expect(ranked[0]!.rationale).toContain('phase-required');
  });
});

describe('QuestionGenerator', () => {
  it('produces deterministic output for same inputs (no LLM)', async () => {
    const gen = new QuestionGenerator({ library: lib, idFactory: stableIds });
    idCounter = 0;
    const a = await gen.generate({
      profile: makeProfile(),
      phase: 'S2',
      area: makeArea(['6.1.2']),
      coverage: new Map(),
      predicate: allowAll,
      engagementContext: 'ctx',
    });
    idCounter = 0;
    const b = await gen.generate({
      profile: makeProfile(),
      phase: 'S2',
      area: makeArea(['6.1.2']),
      coverage: new Map(),
      predicate: allowAll,
      engagementContext: 'ctx',
    });
    expect(a.map((s) => s.sourceLibraryId)).toEqual(b.map((s) => s.sourceLibraryId));
  });

  it('excludes already-asked and already-answered questions', async () => {
    const gen = new QuestionGenerator({ library: lib, idFactory: stableIds });
    const blocked = lib.find({ clauses: ['6.1.2'] })[0]!.id;
    const out = await gen.generate({
      profile: makeProfile(),
      phase: 'S2',
      area: makeArea(['6.1.2']),
      coverage: new Map(),
      predicate: {
        isAlreadyAsked: (id: QuestionLibraryId) => id === blocked,
        isAlreadyAnswered: () => false,
      },
      engagementContext: 'ctx',
    });
    expect(out.find((s) => s.sourceLibraryId === blocked)).toBeUndefined();
  });

  it('boosts low-coverage clauses to the top', async () => {
    const gen = new QuestionGenerator({ library: lib, idFactory: stableIds });
    // Mark Q-CL6-001 (6.1.2) clause as fully evidenced — generator should demote it
    const cov = new Map<string, CoverageState>([
      [
        '6.1.2',
        {
          firmId: FIRM,
          engagementId: ENGAGEMENT,
          clauseId: asClauseId('6.1.2'),
          status: 'evidenced',
          confidence: 1,
          lastUpdate: 'now',
          lastClaimIds: [],
        },
      ],
    ]);
    const out = await gen.generate({
      profile: makeProfile(),
      phase: 'S2',
      area: makeArea(['6.1.2', '6.1.4']),
      coverage: cov,
      predicate: allowAll,
      engagementContext: 'ctx',
    });
    expect(out.length).toBeGreaterThan(0);
    expect(out[0]!.sourceLibraryId).not.toBe('Q-CL6-001');
  });

  it('emits provenance fields on every suggestion', async () => {
    const gen = new QuestionGenerator({ library: lib, idFactory: stableIds });
    const out = await gen.generate({
      profile: makeProfile(),
      phase: 'S2',
      area: makeArea(['6.1.2']),
      coverage: new Map(),
      predicate: allowAll,
      engagementContext: 'ctx',
    });
    for (const s of out) {
      expect(s.sourceLibraryId).toBeDefined();
      expect(s.libraryVersion).toBeGreaterThan(0);
      expect(s.rationale.length).toBeGreaterThan(0);
      expect(s.text.length).toBeGreaterThan(0);
    }
  });

  it('contextualises top-N when contextualizer is provided, never inventing new questions', async () => {
    const gen = new QuestionGenerator({
      library: lib,
      idFactory: stableIds,
      contextualizer: {
        async rewrite(input) {
          return {
            text: `[ctx] ${input.libraryText}`,
            modelInvocationId: 'mi-ctx-1' as never,
          };
        },
      },
    });
    const out = await gen.generate({
      profile: makeProfile(),
      phase: 'S2',
      area: makeArea(['6.1.2']),
      coverage: new Map(),
      predicate: allowAll,
      engagementContext: 'ctx',
      contextualizeTopN: 1,
    });
    expect(out[0]!.text.startsWith('[ctx] ')).toBe(true);
    expect(out[0]!.contextualizedFromLibraryId).toBe(out[0]!.sourceLibraryId);
    expect(out[0]!.modelInvocationId).toBe('mi-ctx-1');
    if (out.length > 1) {
      expect(out[1]!.contextualizedFromLibraryId).toBeNull();
    }
  });

  it('respects the limit parameter', async () => {
    const gen = new QuestionGenerator({ library: lib, idFactory: stableIds });
    const out = await gen.generate({
      profile: makeProfile(),
      phase: 'S2',
      area: makeArea(['6.1.2', '6.1.4', '8.1', '9.1']),
      coverage: new Map(),
      predicate: allowAll,
      engagementContext: 'ctx',
      limit: 3,
    });
    expect(out.length).toBeLessThanOrEqual(3);
  });

  it('embeds follow-up question ids', async () => {
    const gen = new QuestionGenerator({ library: lib, idFactory: stableIds });
    const out = await gen.generate({
      profile: {
        ...makeProfile(),
        inScopeClauses: [asClauseId('4.3')],
        inScopeAnnexControls: [],
      },
      phase: 'S1',
      area: makeArea(['4.3']),
      coverage: new Map(),
      predicate: allowAll,
      engagementContext: 'ctx',
      limit: 10,
    });
    const sug = out.find((s) => s.sourceLibraryId === 'Q-CL4-001');
    expect(sug).toBeDefined();
    expect(sug!.followUpQuestionIds.length).toBeGreaterThan(0);
  });
});
