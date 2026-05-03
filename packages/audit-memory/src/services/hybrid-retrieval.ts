// SPDX-License-Identifier: BUSL-1.1
import type { EngagementContext } from '../domain/tenant.js';
import type { RetrievalCandidate } from '../domain/invocation.js';
import type { AuditMemoryStore } from '../adapters/store.js';
import type { BM25Adapter, VectorAdapter } from '../adapters/retrieval.js';
import type { Clock } from './clock.js';
import type { IdFactory } from './id.js';
import type { ClaimGraph } from './claim-graph.js';

export const RRF_K = 60;

export interface HybridRetrievalOpts {
  limit?: number;
  graphMaxDepth?: number;
  graphSeeds?: string[];
}

export interface HybridRetrievalResult {
  invocationId: string;
  ranked: RetrievalCandidate[];
}

export interface HybridRetrievalOrchestratorDeps {
  store: AuditMemoryStore;
  bm25: BM25Adapter;
  vector: VectorAdapter;
  graph: ClaimGraph;
  clock: Clock;
  ids: IdFactory;
}

interface FusionRow {
  claimId: string;
  lexicalRank: number | null;
  vectorRank: number | null;
  graphHops: number | null;
  source: ('bm25' | 'vector' | 'graph')[];
}

export class HybridRetrievalOrchestrator {
  constructor(private readonly deps: HybridRetrievalOrchestratorDeps) {}

  async retrieve(
    ctx: EngagementContext,
    query: string,
    opts: HybridRetrievalOpts = {},
  ): Promise<HybridRetrievalResult> {
    const limit = opts.limit ?? 20;
    const graphMaxDepth = Math.min(opts.graphMaxDepth ?? 3, 3);
    const seeds = opts.graphSeeds ?? [];

    const lexical = await this.deps.bm25.search(ctx, query, limit * 2);
    const embedding = await this.deps.vector.embed(query);
    const vec = await this.deps.vector.search(ctx, embedding, limit * 2);

    let graphHits: { claimId: string; depth: number }[] = [];
    if (seeds.length > 0) {
      graphHits = await this.deps.graph.traverse(ctx, seeds, graphMaxDepth);
    }

    const fusion = new Map<string, FusionRow>();
    lexical.forEach((hit, idx) => {
      const row = fusion.get(hit.claimId) ?? {
        claimId: hit.claimId,
        lexicalRank: null,
        vectorRank: null,
        graphHops: null,
        source: [],
      };
      row.lexicalRank = idx;
      if (!row.source.includes('bm25')) row.source.push('bm25');
      fusion.set(hit.claimId, row);
    });
    vec.forEach((hit, idx) => {
      const row = fusion.get(hit.claimId) ?? {
        claimId: hit.claimId,
        lexicalRank: null,
        vectorRank: null,
        graphHops: null,
        source: [],
      };
      row.vectorRank = idx;
      if (!row.source.includes('vector')) row.source.push('vector');
      fusion.set(hit.claimId, row);
    });
    for (const g of graphHits) {
      const row = fusion.get(g.claimId) ?? {
        claimId: g.claimId,
        lexicalRank: null,
        vectorRank: null,
        graphHops: null,
        source: [],
      };
      row.graphHops = g.depth;
      if (!row.source.includes('graph')) row.source.push('graph');
      fusion.set(g.claimId, row);
    }

    const candidates: RetrievalCandidate[] = [...fusion.values()].map((row) => {
      let score = 0;
      if (row.lexicalRank !== null) score += 1 / (RRF_K + row.lexicalRank + 1);
      if (row.vectorRank !== null) score += 1 / (RRF_K + row.vectorRank + 1);
      if (row.graphHops !== null) score += 1 / (RRF_K + row.graphHops + 1);
      return {
        claimId: row.claimId,
        lexicalRank: row.lexicalRank,
        vectorRank: row.vectorRank,
        graphHops: row.graphHops,
        fusedScore: score,
        source: row.source,
      };
    });

    candidates.sort((a, b) => b.fusedScore - a.fusedScore);
    const ranked = candidates.slice(0, limit);

    const invocationId = this.deps.ids.uuid();
    const now = this.deps.clock.nowIso();
    await this.deps.store.insertRetrievalInvocation(ctx, {
      id: invocationId,
      firmId: ctx.firmId,
      engagementId: ctx.engagementId,
      query,
      candidates,
      rankedResults: ranked,
      modelInvocationId: null,
      atTime: now,
    });
    return { invocationId, ranked };
  }
}
