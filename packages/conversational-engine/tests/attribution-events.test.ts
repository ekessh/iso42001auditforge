// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { asClauseId } from '../src/types/ids.js';
import {
  AnswerAttributionEngine,
  AttributionEventBus,
  type AttributionEvent,
} from '../src/attribution/index.js';
import {
  ENGAGEMENT,
  FakeClaimExtractor,
  FakeEpisodeStore,
  FakeGraphReader,
  FakeReRanker,
  FakeRetrieval,
  buildClaim,
  emptyCoverage,
  makeAnswer,
  makeClauseCatalog,
} from './fixtures.js';

describe('AttributionEngine event bus', () => {
  it('publishes attribution.completed at the end of attribute()', async () => {
    const events: AttributionEvent[] = [];
    const bus = new AttributionEventBus();
    bus.on((e) => {
      events.push(e);
    });
    const engine = new AnswerAttributionEngine({
      episodeStore: new FakeEpisodeStore(),
      extractor: new FakeClaimExtractor([buildClaim('c1', 'we have a process')]),
      retrieval: new FakeRetrieval([{ clauseId: asClauseId('5.1'), score: 0.9, source: 'pgvector' }]),
      reranker: new FakeReRanker([{ clauseId: '5.1', confidence: 0.95, rationale: 'matches policy clause' }]),
      clauseCatalog: makeClauseCatalog(['5.1']),
      graphReader: new FakeGraphReader([]),
      events: bus,
    });
    await engine.attribute({
      answer: makeAnswer('We have a process for risk reviews.'),
      priorCoverage: emptyCoverage(),
      questionTargetedClauses: [asClauseId('5.1')],
    });
    expect(events.find((e) => e.name === 'attribution.completed')).toBeDefined();
  });

  it('publishes attribution.contradiction.detected when graph reader returns hits', async () => {
    const events: AttributionEvent[] = [];
    const bus = new AttributionEventBus();
    bus.on((e) => {
      events.push(e);
    });
    const engine = new AnswerAttributionEngine({
      episodeStore: new FakeEpisodeStore(),
      extractor: new FakeClaimExtractor([buildClaim('c1', 'we have a process', 'has', 'org', 'risk-process')]),
      retrieval: new FakeRetrieval([{ clauseId: asClauseId('6.1'), score: 0.9, source: 'pgvector' }]),
      reranker: new FakeReRanker([{ clauseId: '6.1', confidence: 0.7, rationale: 'risk' }]),
      clauseCatalog: makeClauseCatalog(['6.1']),
      graphReader: new FakeGraphReader([
        { subject: 'org', predicate: 'has', contradictsClaimId: '00000000-0000-4000-8000-000000000beef' },
      ]),
      events: bus,
    });
    await engine.attribute({
      answer: makeAnswer('We have a process.'),
      priorCoverage: emptyCoverage(),
      questionTargetedClauses: [asClauseId('6.1')],
    });
    expect(events.some((e) => e.name === 'attribution.contradiction.detected')).toBe(true);
  });

  it('publishes attribution.evidence.gap.detected when targeted clauses not covered', async () => {
    const events: AttributionEvent[] = [];
    const bus = new AttributionEventBus();
    bus.on((e) => {
      events.push(e);
    });
    const engine = new AnswerAttributionEngine({
      episodeStore: new FakeEpisodeStore(),
      extractor: new FakeClaimExtractor([buildClaim('c1', 'we have a process')]),
      retrieval: new FakeRetrieval([{ clauseId: asClauseId('6.1'), score: 0.9, source: 'pgvector' }]),
      reranker: new FakeReRanker([{ clauseId: '6.1', confidence: 0.95, rationale: 'risk' }]),
      clauseCatalog: makeClauseCatalog(['5.1', '6.1']),
      graphReader: new FakeGraphReader([]),
      events: bus,
    });
    await engine.attribute({
      answer: makeAnswer('Anything.'),
      priorCoverage: emptyCoverage(),
      questionTargetedClauses: [asClauseId('5.1')],
    });
    const gap = events.find((e) => e.name === 'attribution.evidence.gap.detected');
    expect(gap).toBeDefined();
    expect((gap as { notCoveredClauses: readonly string[] } | undefined)?.notCoveredClauses).toContain('5.1');
  });

  it('off() unsubscribes a listener', async () => {
    const events: AttributionEvent[] = [];
    const bus = new AttributionEventBus();
    const off = bus.on((e) => events.push(e));
    off();
    await bus.publish({
      name: 'attribution.completed',
      engagementId: ENGAGEMENT,
      episodeId: 'ep-x' as never,
      bundle: { engagementId: ENGAGEMENT, episodeId: 'ep-x' as never, cards: [], notCovered: [], droppedHallucinations: [] },
      deltas: [],
      at: new Date().toISOString(),
    });
    expect(events.length).toBe(0);
  });
});
