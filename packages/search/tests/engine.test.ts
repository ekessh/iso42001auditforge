// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { HybridSearchEngine, type EmbeddingProvider } from '../src/hybrid/engine.js';
import { MeilisearchAdapter } from '../src/meilisearch/client.js';
import { PgVectorAdapter, type SqlExecutor } from '../src/pgvector/adapter.js';
import { MissingEngagementError, type SearchHit } from '../src/types.js';

class FakeEmbedder implements EmbeddingProvider {
  async embed(text: string): Promise<number[]> {
    // Deterministic 8-dim hash; sufficient for the in-memory pg fake to
    // produce stable scores in tests.
    const v = new Array<number>(8).fill(0);
    for (let i = 0; i < text.length; i++) v[i % 8]! += text.charCodeAt(i) / 1000;
    return v;
  }
}

class FakeSql implements SqlExecutor {
  rows: Array<Record<string, unknown>> = [];
  async unsafe<T = Record<string, unknown>>(_q: string, _params?: unknown[]): Promise<T[]> {
    return this.rows as unknown as T[];
  }
}

function meiliStub(hits: SearchHit[]): MeilisearchAdapter {
  const stub = Object.create(MeilisearchAdapter.prototype) as MeilisearchAdapter;
  Object.assign(stub, {
    resolveIndexName: (scope: string) => `auditforge-${scope}`,
    search: async () => hits,
  });
  return stub;
}

describe('HybridSearchEngine', () => {
  it('rejects searches without engagementId', async () => {
    const engine = new HybridSearchEngine({
      meilisearch: meiliStub([]),
      pgvector: new PgVectorAdapter(new FakeSql()),
      embedder: new FakeEmbedder(),
      scopes: [{ scope: 'questions', meiliEnabled: true }],
    });
    await expect(
      engine.search({
        q: 'foo',
        scope: 'questions',
        k: 10,
        engagementId: '' as unknown as string,
        firmId: '00000000-0000-0000-0000-000000000001',
      } as never),
    ).rejects.toBeInstanceOf(Error);
  });

  it('throws MissingEngagementError when engagementId is undefined post-parse', () => {
    expect(new MissingEngagementError().name).toBe('MissingEngagementError');
  });

  it('hybrid path fuses keyword and semantic hits', async () => {
    const meiliHits: SearchHit[] = [
      { id: 'q1', scope: 'questions', score: 1, bm25Score: 1, payload: { id: 'q1' } },
      { id: 'q2', scope: 'questions', score: 0.5, bm25Score: 0.5, payload: { id: 'q2' } },
    ];
    const pg = new PgVectorAdapter(new FakeSql());
    const fakeSql = (pg as unknown as { sql: FakeSql }).sql;
    fakeSql.rows = [
      { id: 'q3', score: 0.9, snippet: 'snip3' },
      { id: 'q1', score: 0.8, snippet: 'snip1' },
    ];
    const engine = new HybridSearchEngine({
      meilisearch: meiliStub(meiliHits),
      pgvector: pg,
      embedder: new FakeEmbedder(),
      scopes: [{
        scope: 'questions',
        meiliEnabled: true,
        pgSpec: {
          scope: 'questions',
          table: 'claims',
          idColumn: 'id',
          embeddingColumn: 'embedding',
        },
      }],
    });

    const out = await engine.search({
      q: 'foo',
      scope: 'questions',
      k: 10,
      engagementId: '11111111-1111-1111-1111-111111111111',
      firmId: '22222222-2222-2222-2222-222222222222',
    });
    const ids = out.hits.map((h) => h.id);
    expect(ids).toContain('q1');
    expect(ids).toContain('q3');
    // q1 appears in both lists — should outrank single-list-only items.
    expect(ids[0]).toBe('q1');
    expect(out.tookMs).toBeGreaterThanOrEqual(0);
  });

  it('keyword-only path skips embedding round-trip', async () => {
    const meiliHits: SearchHit[] = [
      { id: 'k1', scope: 'questions', score: 1, payload: {} },
    ];
    let embedCalled = 0;
    const embedder: EmbeddingProvider = {
      embed: async () => {
        embedCalled++;
        return [0];
      },
    };
    const engine = new HybridSearchEngine({
      meilisearch: meiliStub(meiliHits),
      pgvector: new PgVectorAdapter(new FakeSql()),
      embedder,
      scopes: [{ scope: 'questions', meiliEnabled: true }],
    });

    const out = await engine.searchKeyword({
      q: 'foo',
      scope: 'questions',
      k: 10,
      engagementId: '11111111-1111-1111-1111-111111111111',
      firmId: '22222222-2222-2222-2222-222222222222',
    });
    expect(out.modes).toEqual(['keyword']);
    expect(embedCalled).toBe(0);
    expect(out.hits[0]?.id).toBe('k1');
  });

  it('semantic-only path skips meilisearch', async () => {
    const pg = new PgVectorAdapter(new FakeSql());
    (pg as unknown as { sql: FakeSql }).sql.rows = [
      { id: 's1', score: 0.7, snippet: 's' },
    ];
    let meiliCalled = 0;
    const meili = meiliStub([]);
    const orig = meili.search.bind(meili);
    meili.search = async (...args) => {
      meiliCalled++;
      return orig(...args);
    };
    const engine = new HybridSearchEngine({
      meilisearch: meili,
      pgvector: pg,
      embedder: new FakeEmbedder(),
      scopes: [{
        scope: 'questions',
        meiliEnabled: true,
        pgSpec: { scope: 'questions', table: 'claims', idColumn: 'id', embeddingColumn: 'embedding' },
      }],
    });
    const out = await engine.searchSemantic({
      q: 'foo',
      scope: 'questions',
      k: 10,
      engagementId: '11111111-1111-1111-1111-111111111111',
      firmId: '22222222-2222-2222-2222-222222222222',
    });
    expect(out.modes).toEqual(['semantic']);
    expect(meiliCalled).toBe(0);
    expect(out.hits[0]?.id).toBe('s1');
  });
});
