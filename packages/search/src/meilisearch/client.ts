// SPDX-License-Identifier: BUSL-1.1
import { MeiliSearch, type Index } from 'meilisearch';
import type { IndexableDocument, SearchHit, SearchScope } from '../types.js';

export interface MeilisearchConfig {
  host: string;
  apiKey?: string;
  indexPrefix?: string;
}

export interface MeilisearchSearchOpts {
  indexName: string;
  query: string;
  filters?: string;
  limit: number;
  attributesToHighlight?: string[];
}

export class MeilisearchAdapter {
  private readonly client: MeiliSearch;
  private readonly indexPrefix: string;

  constructor(cfg: MeilisearchConfig) {
    this.client = new MeiliSearch({ host: cfg.host, apiKey: cfg.apiKey ?? '' });
    this.indexPrefix = cfg.indexPrefix ?? 'auditforge';
  }

  resolveIndexName(scope: SearchScope): string {
    return `${this.indexPrefix}-${scope}`;
  }

  async ensureIndex(scope: SearchScope, primaryKey = 'id'): Promise<Index> {
    const name = this.resolveIndexName(scope);
    try {
      return await this.client.getIndex(name);
    } catch {
      const task = await this.client.createIndex(name, { primaryKey });
      await this.client.waitForTask(task.taskUid);
      const index = this.client.index(name);
      // Filter on engagementId is mandatory for tenant scoping; without
      // declaring it as filterable Meilisearch refuses filter clauses.
      await index.updateFilterableAttributes([
        'engagementId',
        'firmId',
        'scope',
        'tags',
        'framework',
        'clauseId',
      ]);
      await index.updateSearchableAttributes(['text', 'title', 'tags']);
      return index;
    }
  }

  async deleteIndex(scope: SearchScope): Promise<void> {
    const name = this.resolveIndexName(scope);
    const task = await this.client.deleteIndex(name);
    await this.client.waitForTask(task.taskUid);
  }

  async upsertBatch(scope: SearchScope, docs: readonly IndexableDocument[]): Promise<void> {
    if (docs.length === 0) return;
    const index = await this.ensureIndex(scope);
    const records = docs.map((d) => ({
      id: d.id,
      scope: d.scope,
      firmId: d.firmId,
      engagementId: d.engagementId,
      text: d.text,
      ...d.payload,
    }));
    const task = await index.addDocuments(records);
    await this.client.waitForTask(task.taskUid);
  }

  async deleteDoc(scope: SearchScope, id: string): Promise<void> {
    const index = await this.ensureIndex(scope);
    const task = await index.deleteDocument(id);
    await this.client.waitForTask(task.taskUid);
  }

  async search(opts: MeilisearchSearchOpts): Promise<SearchHit[]> {
    const index = this.client.index(opts.indexName);
    const result = await index.search(opts.query, {
      limit: opts.limit,
      ...(opts.filters !== undefined ? { filter: opts.filters } : {}),
      attributesToHighlight: opts.attributesToHighlight ?? ['text'],
    });
    return result.hits.map((h, idx) => {
      const id = String((h as { id?: unknown }).id ?? '');
      const text = typeof (h as { text?: unknown }).text === 'string' ? ((h as { text: string }).text) : '';
      const score = scoreFromRank(idx, opts.limit);
      const formatted = (h as { _formatted?: { text?: string } })._formatted;
      return {
        id,
        scope: ((h as { scope?: unknown }).scope ?? 'all') as SearchScope,
        score,
        bm25Score: score,
        snippet: formatted?.text ?? text.slice(0, 200),
        payload: h as Record<string, unknown>,
      };
    });
  }

  /**
   * Build a Meilisearch filter expression that ANDs engagement scoping with
   * any caller-supplied filters. Engagement scoping is non-negotiable.
   */
  static buildFilterExpression(engagementId: string, extra?: Record<string, unknown>): string {
    const parts: string[] = [`engagementId = "${engagementId}"`];
    if (extra) {
      for (const [k, v] of Object.entries(extra)) {
        if (Array.isArray(v)) {
          if (v.length === 0) continue;
          parts.push(`(${v.map((x) => `${k} = "${escapeMeili(String(x))}"`).join(' OR ')})`);
        } else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
          parts.push(`${k} = "${escapeMeili(String(v))}"`);
        }
      }
    }
    return parts.join(' AND ');
  }
}

function escapeMeili(s: string): string {
  return s.replace(/"/g, '\\"');
}

function scoreFromRank(rank: number, limit: number): number {
  // Convert position to a 0..1 score so it can be RRF-fused with vector scores.
  return Math.max(0, 1 - rank / Math.max(limit, 1));
}
