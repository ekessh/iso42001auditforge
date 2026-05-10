// SPDX-License-Identifier: BUSL-1.1
//
// Search service — wires the @auditforge/search hybrid engine to the
// API's request lifecycle. Embeddings are produced by the local Ollama
// provider by default (tier=small per CLAUDE.md). Every successful query
// emits a `search.executed` event into the audit ledger so peer-review
// reconstruction can replay an auditor's exact search trail.

import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  HybridSearchEngine,
  MeilisearchAdapter,
  PgVectorAdapter,
  type EmbeddingProvider,
  type ScopeBinding,
  type SearchHit,
  type SearchQuery,
  type SearchResult,
} from '@auditforge/search';
import { createHash } from 'node:crypto';
import type postgres from 'postgres';
import { APP_CONFIG } from '../../config/config.module.js';
import type { AppConfig } from '../../config/config.schema.js';
import { PG_CLIENT } from '../../db/db.module.js';
import type { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';
import { loadSearchConfig, type SearchConfig } from './search.config.js';
import type { SearchRequest } from './dto.js';

export interface SearchContext {
  firmId: string;
  engagementId: string;
  auditorId: string;
  requestId?: string;
}

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private readonly searchCfg: SearchConfig;
  private engine!: HybridSearchEngine;

  constructor(
    @Inject(APP_CONFIG) private readonly appCfg: AppConfig,
    @Inject(PG_CLIENT) private readonly sql: postgres.Sql,
    private readonly ledger: AuditEngineAdapter,
  ) {
    this.searchCfg = loadSearchConfig();
    void this.appCfg;
  }

  onModuleInit(): void {
    const meili = new MeilisearchAdapter({
      host: this.searchCfg.MEILISEARCH_HOST,
      apiKey: this.searchCfg.MEILISEARCH_API_KEY,
      indexPrefix: this.searchCfg.MEILISEARCH_INDEX_PREFIX,
    });
    const pg = new PgVectorAdapter({
      unsafe: async <T = Record<string, unknown>>(query: string, params?: unknown[]) =>
        (await this.sql.unsafe<Record<string, unknown>[]>(query, params as never)) as unknown as T[],
    });
    const embedder = new OllamaEmbeddingProvider(
      this.searchCfg.OLLAMA_HOST,
      this.searchCfg.OLLAMA_EMBED_MODEL,
      this.searchCfg.SEARCH_EMBED_DIMENSION,
    );
    const scopes: ScopeBinding[] = [
      { scope: 'questions', meiliEnabled: true },
      { scope: 'clauses', meiliEnabled: true },
      { scope: 'probes', meiliEnabled: true },
      { scope: 'catalogues', meiliEnabled: true },
      {
        scope: 'evidence',
        meiliEnabled: true,
        pgSpec: {
          scope: 'evidence',
          table: 'episodes',
          idColumn: 'id',
          embeddingColumn: 'embedding',
          textColumn: 'source',
        },
      },
      {
        scope: 'findings',
        meiliEnabled: true,
        pgSpec: {
          scope: 'findings',
          table: 'candidate_findings',
          idColumn: 'id',
          embeddingColumn: 'embedding',
          textColumn: 'rationale',
        },
      },
      {
        scope: 'working_papers',
        meiliEnabled: true,
        pgSpec: {
          scope: 'working_papers',
          table: 'working_papers',
          idColumn: 'id',
          embeddingColumn: 'embedding',
          textColumn: 'title',
        },
      },
      {
        scope: 'traces',
        meiliEnabled: true,
        pgSpec: {
          scope: 'traces',
          table: 'claims',
          idColumn: 'id',
          embeddingColumn: 'embedding',
          textColumn: 'object_text',
        },
      },
    ];
    this.engine = new HybridSearchEngine({
      meilisearch: meili,
      pgvector: pg,
      embedder,
      scopes,
    });
  }

  async hybrid(req: SearchRequest, ctx: SearchContext): Promise<SearchResult> {
    return this.run('hybrid', req, ctx, () => this.engine.search(this.toQuery(req, ctx)));
  }

  async semantic(req: SearchRequest, ctx: SearchContext): Promise<SearchResult> {
    return this.run('semantic', req, ctx, () => this.engine.searchSemantic(this.toQuery(req, ctx)));
  }

  async keyword(req: SearchRequest, ctx: SearchContext): Promise<SearchResult> {
    return this.run('keyword', req, ctx, () => this.engine.searchKeyword(this.toQuery(req, ctx)));
  }

  private async run(
    mode: 'hybrid' | 'semantic' | 'keyword',
    req: SearchRequest,
    ctx: SearchContext,
    exec: () => Promise<SearchResult>,
  ): Promise<SearchResult> {
    const result = await exec();
    await this.emitLedgerEvent(mode, req, ctx, result.hits);
    return result;
  }

  private toQuery(req: SearchRequest, ctx: SearchContext): SearchQuery {
    return {
      q: req.q,
      engagementId: ctx.engagementId,
      firmId: ctx.firmId,
      scope: req.scope,
      ...(req.filters !== undefined ? { filters: req.filters } : {}),
      k: req.k,
    };
  }

  private async emitLedgerEvent(
    mode: string,
    req: SearchRequest,
    ctx: SearchContext,
    hits: readonly SearchHit[],
  ): Promise<void> {
    try {
      const queryHash = createHash('sha256').update(req.q).digest('hex');
      await this.ledger.append({
        firmId: ctx.firmId,
        engagementId: ctx.engagementId,
        actorId: ctx.auditorId,
        type: 'search.executed',
        entity: 'search',
        entityId: queryHash.slice(0, 16),
        payload: {
          mode,
          scope: req.scope,
          queryHash,
          k: req.k,
          resultCount: hits.length,
          ...(ctx.requestId !== undefined ? { requestId: ctx.requestId } : {}),
        },
        ...(ctx.requestId !== undefined ? { requestId: ctx.requestId } : {}),
      });
    } catch (err) {
      this.logger.warn({ err }, 'search ledger append failed');
    }
  }
}

class OllamaEmbeddingProvider implements EmbeddingProvider {
  constructor(
    private readonly host: string,
    private readonly model: string,
    private readonly dim: number,
  ) {}

  async embed(text: string): Promise<number[]> {
    const r = await fetch(`${this.host}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, prompt: text }),
    });
    if (!r.ok) throw new Error(`ollama embed ${r.status}: ${await r.text()}`);
    const body = (await r.json()) as { embedding?: number[]; embeddings?: number[][] };
    const v = body.embedding ?? body.embeddings?.[0] ?? [];
    if (v.length === this.dim) return v;
    if (v.length > this.dim) return v.slice(0, this.dim);
    // Zero-pad smaller embeddings (e.g., 384-dim sentence-transformers) so the
    // schema's vector(1536) accepts the row without a flag day.
    return [...v, ...new Array<number>(this.dim - v.length).fill(0)];
  }
}
