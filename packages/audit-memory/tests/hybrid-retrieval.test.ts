// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import {
  StaticBM25Adapter,
  StaticVectorAdapter,
  buildClaim,
  createHarness,
} from './fixtures.js';
import { RRF_K } from '../src/services/hybrid-retrieval.js';

describe('HybridRetrievalOrchestrator', () => {
  it('fuses BM25 + vector via reciprocal rank fusion (k=60)', async () => {
    const h = createHarness();
    const v = await h.freshSchema();
    const c1 = await h.claimGraph.createClaim(h.ctx, buildClaim(h.ctx, v, { subject: 'C1' }));
    const c2 = await h.claimGraph.createClaim(h.ctx, buildClaim(h.ctx, v, { subject: 'C2' }));
    const c3 = await h.claimGraph.createClaim(h.ctx, buildClaim(h.ctx, v, { subject: 'C3' }));
    const bm25 = new StaticBM25Adapter([
      { claimId: c1.id, score: 5 },
      { claimId: c2.id, score: 4 },
    ]);
    const vec = new StaticVectorAdapter(
      [0.1, 0.2, 0.3],
      [
        { claimId: c2.id, score: 0.9 },
        { claimId: c3.id, score: 0.7 },
      ],
    );
    const orchestrator = h.buildHybridRetrieval({ bm25, vector: vec });
    const result = await orchestrator.retrieve(h.ctx, 'how is data labeled');
    expect(result.ranked[0]?.claimId).toBe(c2.id);
    const c2Score = result.ranked.find((r) => r.claimId === c2.id)?.fusedScore ?? 0;
    const expected = 1 / (RRF_K + 1 + 1) + 1 / (RRF_K + 0 + 1);
    expect(c2Score).toBeCloseTo(expected, 6);
  });

  it('records every retrieval in retrieval_invocations', async () => {
    const h = createHarness();
    const orchestrator = h.buildHybridRetrieval({
      bm25: new StaticBM25Adapter([]),
      vector: new StaticVectorAdapter([0], []),
    });
    await orchestrator.retrieve(h.ctx, 'q');
    const list = await h.store.listRetrievalInvocations(h.ctx);
    expect(list.length).toBe(1);
    expect(list[0]?.query).toBe('q');
  });

  it('includes graph-traversal candidates with hops attribution', async () => {
    const h = createHarness();
    const v = await h.freshSchema();
    const a = await h.claimGraph.createClaim(h.ctx, buildClaim(h.ctx, v, { subject: 'A' }));
    const b = await h.claimGraph.createClaim(h.ctx, buildClaim(h.ctx, v, { subject: 'B' }));
    await h.claimGraph.addRelation(h.ctx, a.id, 'supports', b.id);
    const orchestrator = h.buildHybridRetrieval({
      bm25: new StaticBM25Adapter([]),
      vector: new StaticVectorAdapter([0], []),
    });
    const result = await orchestrator.retrieve(h.ctx, 'q', { graphSeeds: [a.id] });
    const graphCandidates = result.ranked.filter((r) => r.source.includes('graph'));
    expect(graphCandidates.length).toBeGreaterThan(0);
    expect(graphCandidates.find((g) => g.claimId === b.id)?.graphHops).toBe(1);
  });

  it('limits results when given a smaller limit', async () => {
    const h = createHarness();
    const v = await h.freshSchema();
    const c1 = await h.claimGraph.createClaim(h.ctx, buildClaim(h.ctx, v, { subject: 'A' }));
    const c2 = await h.claimGraph.createClaim(h.ctx, buildClaim(h.ctx, v, { subject: 'B' }));
    const orchestrator = h.buildHybridRetrieval({
      bm25: new StaticBM25Adapter([
        { claimId: c1.id, score: 1 },
        { claimId: c2.id, score: 0.5 },
      ]),
      vector: new StaticVectorAdapter([0], []),
    });
    const result = await orchestrator.retrieve(h.ctx, 'q', { limit: 1 });
    expect(result.ranked.length).toBe(1);
  });

  it('marks each candidate with its source list', async () => {
    const h = createHarness();
    const v = await h.freshSchema();
    const c = await h.claimGraph.createClaim(h.ctx, buildClaim(h.ctx, v));
    const orchestrator = h.buildHybridRetrieval({
      bm25: new StaticBM25Adapter([{ claimId: c.id, score: 1 }]),
      vector: new StaticVectorAdapter([0], [{ claimId: c.id, score: 1 }]),
    });
    const result = await orchestrator.retrieve(h.ctx, 'q');
    expect(result.ranked[0]?.source.sort()).toEqual(['bm25', 'vector']);
  });
});
