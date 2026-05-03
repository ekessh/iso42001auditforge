// SPDX-License-Identifier: BUSL-1.1
//
// Probe P-AF-CLAUSE-01 — Hallucination guard.
//
// Asserts that the Answer Attribution Engine never accepts a clauseId that is
// not present in the injected clause catalog, regardless of what the re-ranker
// produces. This is a hard rule per CLAUDE.md "Hard Rules Enforced in Code"
// and v3 §15.4 / §0.1 ("Schema constraints first").
import { describe, expect, it, vi } from 'vitest';
import { AnswerAttributionEngine } from '../../src/attribution/index.js';
import { asClauseId } from '../../src/types/ids.js';
import {
  buildClaim,
  emptyCoverage,
  FakeClaimExtractor,
  FakeEpisodeStore,
  FakeGraphReader,
  FakeReRanker,
  FakeRetrieval,
  makeAnswer,
  makeClauseCatalog,
} from '../fixtures.js';

const VALID = ['6.1.2', '8.1', 'A.6.2.5'];

describe('Probe P-AF-CLAUSE-01: re-ranker must emit only valid clause IDs', () => {
  it('drops every hallucinated clauseId emitted by the re-ranker', async () => {
    const logger = { warn: vi.fn(), info: vi.fn() };
    const engine = new AnswerAttributionEngine({
      episodeStore: new FakeEpisodeStore(),
      extractor: new FakeClaimExtractor([buildClaim('c1', 'we have docs')]),
      retrieval: new FakeRetrieval([
        { clauseId: asClauseId('6.1.2'), score: 1, source: 'pgvector' },
      ]),
      reranker: new FakeReRanker([
        { clauseId: 'INVENTED-CLAUSE-A', confidence: 0.99, rationale: 'a' },
        { clauseId: 'INVENTED-CLAUSE-B', confidence: 0.99, rationale: 'b' },
        { clauseId: '6.1.2', confidence: 0.99, rationale: 'real' },
      ]),
      clauseCatalog: makeClauseCatalog(VALID),
      graphReader: new FakeGraphReader(),
      logger,
    });
    const r = await engine.attribute({
      answer: makeAnswer('docs'),
      priorCoverage: emptyCoverage(),
      questionTargetedClauses: [asClauseId('6.1.2')],
    });
    expect(r.bundle.droppedHallucinations.sort()).toEqual([
      'INVENTED-CLAUSE-A',
      'INVENTED-CLAUSE-B',
    ]);
    for (const a of r.bundle.cards[0]!.attributions) {
      expect(VALID).toContain(a.clauseId as unknown as string);
    }
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });

  it('returns empty attributions when every re-ranker output is hallucinated', async () => {
    const engine = new AnswerAttributionEngine({
      episodeStore: new FakeEpisodeStore(),
      extractor: new FakeClaimExtractor([buildClaim('c1', 'we have docs')]),
      retrieval: new FakeRetrieval([]),
      reranker: new FakeReRanker([
        { clauseId: 'X', confidence: 0.99, rationale: 'fake' },
      ]),
      clauseCatalog: makeClauseCatalog(VALID),
      graphReader: new FakeGraphReader(),
    });
    const r = await engine.attribute({
      answer: makeAnswer('docs'),
      priorCoverage: emptyCoverage(),
      questionTargetedClauses: [asClauseId('6.1.2')],
    });
    expect(r.bundle.cards[0]!.attributions.length).toBe(0);
    expect(r.bundle.droppedHallucinations).toContain('X');
  });

  it('mixed case where some are hallucinated and some are valid keeps only the valid', async () => {
    const engine = new AnswerAttributionEngine({
      episodeStore: new FakeEpisodeStore(),
      extractor: new FakeClaimExtractor([buildClaim('c1', 'we have docs')]),
      retrieval: new FakeRetrieval([]),
      reranker: new FakeReRanker([
        { clauseId: 'A.6.2.5', confidence: 0.95, rationale: 'real' },
        { clauseId: 'BOGUS', confidence: 0.95, rationale: 'fake' },
      ]),
      clauseCatalog: makeClauseCatalog(VALID),
      graphReader: new FakeGraphReader(),
    });
    const r = await engine.attribute({
      answer: makeAnswer('docs'),
      priorCoverage: emptyCoverage(),
      questionTargetedClauses: [asClauseId('A.6.2.5')],
    });
    expect(r.bundle.cards[0]!.attributions.length).toBe(1);
    expect(r.bundle.cards[0]!.attributions[0]!.clauseId as unknown as string).toBe('A.6.2.5');
  });
});
