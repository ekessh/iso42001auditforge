// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it, vi } from 'vitest';
import {
  AnswerAttributionEngine,
  classifyConfidence,
  ConfidenceBandThresholds,
  routeBand,
} from '../src/attribution/index.js';
import { asClauseId } from '../src/types/ids.js';
import {
  buildClaim,
  emptyCoverage,
  ENGAGEMENT,
  FakeClaimExtractor,
  FakeEpisodeStore,
  FakeGraphReader,
  FakeReRanker,
  FakeRetrieval,
  FakeWorkingPaperLinker,
  makeAnswer,
  makeClauseCatalog,
} from './fixtures.js';

const VALID_CLAUSES = ['6.1.2', '6.1.4', '8.1', '9.1', 'A.6.2.5', 'A.7.4', 'A.9.4'];

function buildEngine(opts?: {
  judgments?: readonly { clauseId: string; confidence: number; rationale: string }[];
  contradictions?: readonly { subject: string; predicate: string; contradictsClaimId: string }[];
  workingPaperLinker?: FakeWorkingPaperLinker;
  logger?: { warn: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };
  claims?: readonly ReturnType<typeof buildClaim>[];
}) {
  const episodeStore = new FakeEpisodeStore();
  const extractor = new FakeClaimExtractor(opts?.claims ?? [buildClaim('claim-1', 'we have a process', 'has', 'org', 'risk-process')]);
  const retrieval = new FakeRetrieval([
    { clauseId: asClauseId('6.1.2'), score: 0.9, source: 'pgvector' },
    { clauseId: asClauseId('A.6.2.5'), score: 0.7, source: 'bm25' },
  ]);
  const reranker = new FakeReRanker(opts?.judgments ?? [
    { clauseId: '6.1.2', confidence: 0.92, rationale: 'mentions risk process' },
  ]);
  const clauseCatalog = makeClauseCatalog(VALID_CLAUSES);
  const graphReader = new FakeGraphReader(opts?.contradictions ?? []);
  return {
    engine: new AnswerAttributionEngine({
      episodeStore,
      extractor,
      retrieval,
      reranker,
      clauseCatalog,
      graphReader,
      ...(opts?.workingPaperLinker ? { workingPaperLinker: opts.workingPaperLinker } : {}),
      ...(opts?.logger ? { logger: opts.logger } : {}),
    }),
    episodeStore,
    extractor,
    retrieval,
    reranker,
    clauseCatalog,
    graphReader,
  };
}

describe('classifyConfidence (band routing)', () => {
  it('HIGH for > 0.85', () => {
    expect(classifyConfidence(0.86)).toBe('HIGH');
    expect(classifyConfidence(0.99)).toBe('HIGH');
  });

  it('MEDIUM for 0.6 to 0.85 inclusive of 0.6 boundary', () => {
    expect(classifyConfidence(0.6)).toBe('MEDIUM');
    expect(classifyConfidence(0.85)).toBe('MEDIUM');
    expect(classifyConfidence(0.7)).toBe('MEDIUM');
  });

  it('LOW for < 0.6', () => {
    expect(classifyConfidence(0.59)).toBe('LOW');
    expect(classifyConfidence(0)).toBe('LOW');
  });

  it('exposes thresholds as constants', () => {
    expect(ConfidenceBandThresholds.HIGH).toBe(0.85);
    expect(ConfidenceBandThresholds.MEDIUM).toBe(0.6);
  });

  it('routeBand returns auto-link for HIGH', () => {
    const r = routeBand('HIGH');
    expect(r.autoLink).toBe(true);
    expect(r.singleClick).toBe(false);
  });

  it('routeBand returns single-click for MEDIUM', () => {
    const r = routeBand('MEDIUM');
    expect(r.singleClick).toBe(true);
    expect(r.autoLink).toBe(false);
  });

  it('routeBand returns opt-in panel for LOW', () => {
    const r = routeBand('LOW');
    expect(r.optInPanelOnly).toBe(true);
    expect(r.autoLink).toBe(false);
    expect(r.singleClick).toBe(false);
  });
});

describe('AnswerAttributionEngine — Step 1 (Episode write)', () => {
  it('writes the raw answer to the episode store', async () => {
    const { engine, episodeStore } = buildEngine();
    await engine.attribute({
      answer: makeAnswer('we have a process'),
      priorCoverage: emptyCoverage(),
      questionTargetedClauses: [asClauseId('6.1.2')],
    });
    expect(episodeStore.lastWritten?.auditeeText).toBe('we have a process');
  });

  it('returns an episodeId on the bundle', async () => {
    const { engine } = buildEngine();
    const r = await engine.attribute({
      answer: makeAnswer('we have a process'),
      priorCoverage: emptyCoverage(),
      questionTargetedClauses: [asClauseId('6.1.2')],
    });
    expect(r.bundle.episodeId).toBeDefined();
  });
});

describe('AnswerAttributionEngine — Step 2 (Claim extraction)', () => {
  it('uses the extractor on the answer text', async () => {
    const { engine } = buildEngine();
    const r = await engine.attribute({
      answer: makeAnswer('we have a process'),
      priorCoverage: emptyCoverage(),
      questionTargetedClauses: [asClauseId('6.1.2')],
    });
    expect(r.bundle.cards.length).toBe(1);
    expect(r.bundle.cards[0]!.claim.text).toBe('we have a process');
  });

  it('handles multiple claims', async () => {
    const { engine } = buildEngine({
      claims: [
        buildClaim('c-a', 'process exists'),
        buildClaim('c-b', 'process is documented'),
      ],
    });
    const r = await engine.attribute({
      answer: makeAnswer('process exists. process is documented.'),
      priorCoverage: emptyCoverage(),
      questionTargetedClauses: [asClauseId('6.1.2')],
    });
    expect(r.bundle.cards.length).toBe(2);
  });
});

describe('AnswerAttributionEngine — Step 3 (Hybrid retrieval)', () => {
  it('passes the limit to the retrieval service', async () => {
    const retrieval = new FakeRetrieval([{ clauseId: asClauseId('6.1.2'), score: 1, source: 'pgvector' }]);
    const spy = vi.spyOn(retrieval, 'retrieve');
    const engine = new AnswerAttributionEngine({
      episodeStore: new FakeEpisodeStore(),
      extractor: new FakeClaimExtractor([buildClaim('claim-1', 'we have a process')]),
      retrieval,
      reranker: new FakeReRanker([{ clauseId: '6.1.2', confidence: 0.9, rationale: 'r' }]),
      clauseCatalog: makeClauseCatalog(VALID_CLAUSES),
      graphReader: new FakeGraphReader(),
    });
    await engine.attribute({
      answer: makeAnswer('process'),
      priorCoverage: emptyCoverage(),
      questionTargetedClauses: [asClauseId('6.1.2')],
      retrievalLimit: 3,
    });
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ limit: 3 }));
  });
});

describe('AnswerAttributionEngine — Step 4 (Re-ranker hallucination guard)', () => {
  it('drops re-ranker outputs whose clauseId is not in the catalog', async () => {
    const logger = { warn: vi.fn(), info: vi.fn() };
    const { engine } = buildEngine({
      logger,
      judgments: [
        { clauseId: 'NOT-A-CLAUSE', confidence: 0.9, rationale: 'fake' },
        { clauseId: '6.1.2', confidence: 0.9, rationale: 'real' },
      ],
    });
    const r = await engine.attribute({
      answer: makeAnswer('process'),
      priorCoverage: emptyCoverage(),
      questionTargetedClauses: [asClauseId('6.1.2')],
    });
    expect(r.bundle.droppedHallucinations).toContain('NOT-A-CLAUSE');
    expect(r.bundle.cards[0]!.attributions.length).toBe(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'attribution.hallucinated_clause_dropped',
      expect.any(Object),
    );
  });

  it('all surviving attributions reference a valid clause', async () => {
    const { engine, clauseCatalog } = buildEngine({
      judgments: [
        { clauseId: 'BAD', confidence: 0.9, rationale: 'x' },
        { clauseId: '6.1.4', confidence: 0.9, rationale: 'y' },
      ],
    });
    const r = await engine.attribute({
      answer: makeAnswer('process'),
      priorCoverage: emptyCoverage(),
      questionTargetedClauses: [asClauseId('6.1.4')],
    });
    for (const a of r.bundle.cards[0]!.attributions) {
      expect(clauseCatalog.has(a.clauseId)).toBe(true);
    }
  });
});

describe('AnswerAttributionEngine — Step 5 (Contradiction check)', () => {
  it('attaches contradictions returned by the graph reader', async () => {
    const { engine } = buildEngine({
      contradictions: [{ subject: 'org', predicate: 'has', contradictsClaimId: '11111111-1111-1111-1111-111111111111' }],
    });
    const r = await engine.attribute({
      answer: makeAnswer('we have a process'),
      priorCoverage: emptyCoverage(),
      questionTargetedClauses: [asClauseId('6.1.2')],
    });
    expect(r.bundle.cards[0]!.contradictions.length).toBe(1);
  });

  it('marks coverage as contradicted when contradictions exist', async () => {
    const { engine } = buildEngine({
      contradictions: [{ subject: 'org', predicate: 'has', contradictsClaimId: '22222222-2222-2222-2222-222222222222' }],
    });
    const r = await engine.attribute({
      answer: makeAnswer('we have a process'),
      priorCoverage: emptyCoverage(),
      questionTargetedClauses: [asClauseId('6.1.2')],
    });
    expect(r.deltas[0]!.toStatus).toBe('contradicted');
  });
});

describe('AnswerAttributionEngine — Step 6 (Coverage update)', () => {
  it('emits CoverageDelta to evidenced for HIGH confidence', async () => {
    const { engine } = buildEngine({
      judgments: [{ clauseId: '6.1.2', confidence: 0.95, rationale: 'h' }],
    });
    const r = await engine.attribute({
      answer: makeAnswer('process'),
      priorCoverage: emptyCoverage(),
      questionTargetedClauses: [asClauseId('6.1.2')],
    });
    expect(r.deltas[0]!.toStatus).toBe('evidenced');
  });

  it('emits CoverageDelta to partial for MEDIUM confidence', async () => {
    const { engine } = buildEngine({
      judgments: [{ clauseId: '6.1.2', confidence: 0.7, rationale: 'm' }],
    });
    const r = await engine.attribute({
      answer: makeAnswer('process'),
      priorCoverage: emptyCoverage(),
      questionTargetedClauses: [asClauseId('6.1.2')],
    });
    expect(r.deltas[0]!.toStatus).toBe('partial');
  });

  it('does not change coverage for LOW confidence', async () => {
    const { engine } = buildEngine({
      judgments: [{ clauseId: '6.1.2', confidence: 0.3, rationale: 'l' }],
    });
    const r = await engine.attribute({
      answer: makeAnswer('process'),
      priorCoverage: emptyCoverage(),
      questionTargetedClauses: [asClauseId('6.1.2')],
    });
    expect(r.deltas.length).toBe(0);
  });
});

describe('AnswerAttributionEngine — Step 7 (Auditor review bundle)', () => {
  it('returns a card per claim', async () => {
    const { engine } = buildEngine({
      claims: [
        buildClaim('a1', 'first claim'),
        buildClaim('a2', 'second claim'),
      ],
    });
    const r = await engine.attribute({
      answer: makeAnswer('two claims'),
      priorCoverage: emptyCoverage(),
      questionTargetedClauses: [asClauseId('6.1.2')],
    });
    expect(r.bundle.cards.length).toBe(2);
  });

  it('cards include attributions and contradictions', async () => {
    const { engine } = buildEngine();
    const r = await engine.attribute({
      answer: makeAnswer('process'),
      priorCoverage: emptyCoverage(),
      questionTargetedClauses: [asClauseId('6.1.2')],
    });
    expect(r.bundle.cards[0]!.attributions).toBeDefined();
    expect(r.bundle.cards[0]!.contradictions).toBeDefined();
  });

  it('every attribution has a confidence band', async () => {
    const { engine } = buildEngine();
    const r = await engine.attribute({
      answer: makeAnswer('process'),
      priorCoverage: emptyCoverage(),
      questionTargetedClauses: [asClauseId('6.1.2')],
    });
    for (const a of r.bundle.cards[0]!.attributions) {
      expect(['HIGH', 'MEDIUM', 'LOW']).toContain(a.band);
    }
  });

  it('every attribution carries a model invocation reference', async () => {
    const { engine } = buildEngine();
    const r = await engine.attribute({
      answer: makeAnswer('process'),
      priorCoverage: emptyCoverage(),
      questionTargetedClauses: [asClauseId('6.1.2')],
    });
    expect(r.bundle.cards[0]!.attributions[0]!.modelInvocationId).toBeDefined();
  });
});

describe('AnswerAttributionEngine — Step 8 (Working paper linkage)', () => {
  it('only auto-links HIGH band attributions', async () => {
    const linker = new FakeWorkingPaperLinker();
    const { engine } = buildEngine({
      workingPaperLinker: linker,
      judgments: [
        { clauseId: '6.1.2', confidence: 0.95, rationale: 'h' },
        { clauseId: '6.1.4', confidence: 0.7, rationale: 'm' },
      ],
    });
    await engine.attribute({
      answer: makeAnswer('process'),
      priorCoverage: emptyCoverage(),
      questionTargetedClauses: [asClauseId('6.1.2')],
    });
    expect(linker.calls).toBe(1);
  });

  it('skips linkage when no linker is provided', async () => {
    const { engine } = buildEngine({
      judgments: [{ clauseId: '6.1.2', confidence: 0.95, rationale: 'h' }],
    });
    const r = await engine.attribute({
      answer: makeAnswer('process'),
      priorCoverage: emptyCoverage(),
      questionTargetedClauses: [asClauseId('6.1.2')],
    });
    expect(r.workingPaperLinks.length).toBe(0);
  });

  it('returns linked WP IDs when linker present and HIGH band', async () => {
    const linker = new FakeWorkingPaperLinker();
    const { engine } = buildEngine({
      workingPaperLinker: linker,
      judgments: [{ clauseId: '6.1.2', confidence: 0.95, rationale: 'h' }],
    });
    const r = await engine.attribute({
      answer: makeAnswer('process'),
      priorCoverage: emptyCoverage(),
      questionTargetedClauses: [asClauseId('6.1.2')],
    });
    expect(r.workingPaperLinks.length).toBe(1);
  });
});

describe('AnswerAttributionEngine — "What did not get covered" panel', () => {
  it('lists targeted clauses that received no evidenced attribution', async () => {
    const { engine } = buildEngine({
      judgments: [{ clauseId: '6.1.2', confidence: 0.95, rationale: 'h' }],
    });
    const r = await engine.attribute({
      answer: makeAnswer('process'),
      priorCoverage: emptyCoverage(),
      questionTargetedClauses: [asClauseId('6.1.2'), asClauseId('6.1.4'), asClauseId('A.6.2.5')],
    });
    expect(r.bundle.notCovered.map((c) => c as unknown as string)).toEqual(
      expect.arrayContaining(['6.1.4', 'A.6.2.5']),
    );
    expect(r.bundle.notCovered.map((c) => c as unknown as string)).not.toContain('6.1.2');
  });

  it('returns all targeted clauses when nothing was evidenced', async () => {
    const { engine } = buildEngine({
      judgments: [{ clauseId: '6.1.2', confidence: 0.4, rationale: 'low' }],
    });
    const r = await engine.attribute({
      answer: makeAnswer('process'),
      priorCoverage: emptyCoverage(),
      questionTargetedClauses: [asClauseId('6.1.2'), asClauseId('6.1.4')],
    });
    expect(r.bundle.notCovered.length).toBe(2);
  });

  it('returns empty notCovered when every targeted clause was evidenced', async () => {
    const { engine } = buildEngine({
      judgments: [
        { clauseId: '6.1.2', confidence: 0.95, rationale: 'h' },
        { clauseId: '6.1.4', confidence: 0.95, rationale: 'h' },
      ],
    });
    const r = await engine.attribute({
      answer: makeAnswer('two evidenced clauses'),
      priorCoverage: emptyCoverage(),
      questionTargetedClauses: [asClauseId('6.1.2'), asClauseId('6.1.4')],
    });
    expect(r.bundle.notCovered.length).toBe(0);
  });
});

describe('AnswerAttributionEngine — end-to-end with mocked LLMs', () => {
  it('produces a complete bundle with all 8 steps wired', async () => {
    const linker = new FakeWorkingPaperLinker();
    const { engine } = buildEngine({
      workingPaperLinker: linker,
      claims: [
        buildClaim('a1', 'we operate a model risk register'),
        buildClaim('a2', 'we approve via a committee'),
      ],
      judgments: [
        { clauseId: '6.1.2', confidence: 0.95, rationale: 'risk register' },
        { clauseId: '8.1', confidence: 0.7, rationale: 'committee approval' },
      ],
    });
    const r = await engine.attribute({
      answer: makeAnswer('we operate a model risk register and approve via a committee'),
      priorCoverage: emptyCoverage(),
      questionTargetedClauses: [asClauseId('6.1.2'), asClauseId('8.1')],
    });
    expect(r.bundle.episodeId).toBeDefined();
    expect(r.bundle.cards.length).toBe(2);
    expect(r.deltas.length).toBeGreaterThan(0);
    expect(r.workingPaperLinks.length).toBeGreaterThan(0);
  });
});
