// SPDX-License-Identifier: BUSL-1.1
import { MeilisearchAdapter } from '../meilisearch/client.js';
import type { PgVectorAdapter, PgVectorTableSpec } from '../pgvector/adapter.js';
import { MissingEngagementError, SearchQuerySchema, type SearchHit, type SearchQuery, type SearchResult, type SearchScope } from '../types.js';
import { rrfFuse } from './rrf.js';

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
}

export interface ScopeBinding {
  scope: SearchScope;
  pgSpec?: PgVectorTableSpec;
  meiliEnabled?: boolean;
}

export interface HybridSearchEngineConfig {
  meilisearch: MeilisearchAdapter;
  pgvector: PgVectorAdapter;
  embedder: EmbeddingProvider;
  scopes: ReadonlyArray<ScopeBinding>;
}

export class HybridSearchEngine {
  private readonly scopeMap: ReadonlyMap<SearchScope, ScopeBinding>;

  constructor(private readonly cfg: HybridSearchEngineConfig) {
    this.scopeMap = new Map(cfg.scopes.map((s) => [s.scope, s]));
  }

  async search(input: SearchQuery): Promise<SearchResult> {
    const parsed = SearchQuerySchema.parse(input);
    if (!parsed.engagementId) throw new MissingEngagementError();
    const start = Date.now();

    const targetScopes = parsed.scope === 'all'
      ? [...this.scopeMap.keys()]
      : [parsed.scope];

    const allKeyword: SearchHit[][] = [];
    const allVector: SearchHit[][] = [];

    for (const scope of targetScopes) {
      const binding = this.scopeMap.get(scope);
      if (!binding) continue;
      if (binding.meiliEnabled !== false) {
        const filter = MeilisearchAdapter.buildFilterExpression(parsed.engagementId, parsed.filters);
        const indexName = this.cfg.meilisearch.resolveIndexName(scope);
        try {
          const hits = await this.cfg.meilisearch.search({
            indexName,
            query: parsed.q,
            filters: filter,
            limit: parsed.k,
          });
          allKeyword.push(hits.map((h) => ({ ...h, scope })));
        } catch {
          // Index may not exist yet for this scope; skip rather than 500.
        }
      }
    }

    const vector = await this.cfg.embedder.embed(parsed.q);
    for (const scope of targetScopes) {
      const binding = this.scopeMap.get(scope);
      if (!binding?.pgSpec) continue;
      try {
        const hits = await this.cfg.pgvector.nearestNeighbors({
          spec: binding.pgSpec,
          vector,
          k: parsed.k,
          engagementId: parsed.engagementId,
          firmId: parsed.firmId,
        });
        allVector.push(hits);
      } catch {
        // Embedding column may be empty for this engagement; skip.
      }
    }

    const fused = rrfFuse([...allKeyword, ...allVector]);
    return {
      hits: fused.slice(0, parsed.k),
      totalEstimated: fused.length,
      tookMs: Date.now() - start,
      modes: ['hybrid'],
    };
  }

  async searchKeyword(input: SearchQuery): Promise<SearchResult> {
    const parsed = SearchQuerySchema.parse(input);
    if (!parsed.engagementId) throw new MissingEngagementError();
    const start = Date.now();
    const targetScopes = parsed.scope === 'all' ? [...this.scopeMap.keys()] : [parsed.scope];
    const lists: SearchHit[][] = [];
    const filter = MeilisearchAdapter.buildFilterExpression(parsed.engagementId, parsed.filters);
    for (const scope of targetScopes) {
      const binding = this.scopeMap.get(scope);
      if (!binding || binding.meiliEnabled === false) continue;
      try {
        const hits = await this.cfg.meilisearch.search({
          indexName: this.cfg.meilisearch.resolveIndexName(scope),
          query: parsed.q,
          filters: filter,
          limit: parsed.k,
        });
        lists.push(hits.map((h) => ({ ...h, scope })));
      } catch {
        /* index not yet created */
      }
    }
    const merged = lists.flat().sort((a, b) => b.score - a.score).slice(0, parsed.k);
    return { hits: merged, totalEstimated: merged.length, tookMs: Date.now() - start, modes: ['keyword'] };
  }

  async searchSemantic(input: SearchQuery): Promise<SearchResult> {
    const parsed = SearchQuerySchema.parse(input);
    if (!parsed.engagementId) throw new MissingEngagementError();
    const start = Date.now();
    const vector = await this.cfg.embedder.embed(parsed.q);
    const targetScopes = parsed.scope === 'all' ? [...this.scopeMap.keys()] : [parsed.scope];
    const lists: SearchHit[][] = [];
    for (const scope of targetScopes) {
      const binding = this.scopeMap.get(scope);
      if (!binding?.pgSpec) continue;
      try {
        const hits = await this.cfg.pgvector.nearestNeighbors({
          spec: binding.pgSpec,
          vector,
          k: parsed.k,
          engagementId: parsed.engagementId,
          firmId: parsed.firmId,
        });
        lists.push(hits);
      } catch {
        /* table may not have embeddings yet */
      }
    }
    const merged = lists.flat().sort((a, b) => b.score - a.score).slice(0, parsed.k);
    return { hits: merged, totalEstimated: merged.length, tookMs: Date.now() - start, modes: ['semantic'] };
  }
}
