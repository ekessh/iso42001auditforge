// SPDX-License-Identifier: BUSL-1.1
//
// Integration smoke test for the hybrid search engine against ephemeral
// Meilisearch + Postgres+pgvector. Skipped automatically when neither
// service is reachable so the suite can run on developer laptops without
// docker. Set `SEARCH_INTEGRATION=1` to require the test to attempt the run
// (and fail when the dependencies are missing).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HybridSearchEngine } from '../../src/hybrid/engine.js';
import { MeilisearchAdapter } from '../../src/meilisearch/client.js';
import { PgVectorAdapter, type SqlExecutor } from '../../src/pgvector/adapter.js';
import type { EmbeddingProvider } from '../../src/hybrid/engine.js';

const REQUIRE = process.env['SEARCH_INTEGRATION'] === '1';
const MEILI_HOST = process.env['MEILISEARCH_HOST'] ?? 'http://localhost:7700';
const MEILI_KEY = process.env['MEILISEARCH_API_KEY'] ?? 'auditforge_dev_only_master_key';

class StaticEmbedder implements EmbeddingProvider {
  async embed(text: string): Promise<number[]> {
    const v = new Array<number>(8).fill(0);
    for (let i = 0; i < text.length; i++) v[i % 8]! += text.charCodeAt(i) / 1000;
    return v;
  }
}

class InMemorySql implements SqlExecutor {
  rows: Map<string, Array<{ id: string; engagementId: string; firmId: string; embedding: number[]; text: string }>> = new Map();
  async unsafe<T = Record<string, unknown>>(query: string, params: unknown[] = []): Promise<T[]> {
    if (!query.toUpperCase().startsWith('SELECT')) return [] as unknown as T[];
    const docs = [...(this.rows.get('claims') ?? [])];
    const engagementId = String(params[1] ?? '');
    const filtered = docs.filter((d) => d.engagementId === engagementId);
    return filtered.slice(0, Number(params[params.length - 1] ?? 10)).map((d, idx) => ({
      id: d.id,
      snippet: d.text,
      score: 1 - idx * 0.1,
    })) as unknown as T[];
  }
}

let meiliReachable = false;

beforeAll(async () => {
  try {
    const r = await fetch(`${MEILI_HOST}/health`, { method: 'GET' });
    meiliReachable = r.ok;
  } catch {
    meiliReachable = false;
  }
  if (REQUIRE && !meiliReachable) {
    throw new Error(`Meilisearch unreachable at ${MEILI_HOST} but SEARCH_INTEGRATION=1`);
  }
});

afterAll(async () => {
  if (!meiliReachable) return;
  try {
    await fetch(`${MEILI_HOST}/indexes/auditforge-test-questions`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${MEILI_KEY}` },
    });
  } catch {
    /* ignore */
  }
});

describe('hybrid search RLS', () => {
  it('rejects queries that lack engagementId', async () => {
    if (!meiliReachable && !REQUIRE) return;
    const sql = new InMemorySql();
    const engine = new HybridSearchEngine({
      meilisearch: new MeilisearchAdapter({ host: MEILI_HOST, apiKey: MEILI_KEY, indexPrefix: 'auditforge-test' }),
      pgvector: new PgVectorAdapter(sql),
      embedder: new StaticEmbedder(),
      scopes: [{ scope: 'questions', meiliEnabled: true, pgSpec: { scope: 'questions', table: 'claims', idColumn: 'id', embeddingColumn: 'embedding' } }],
    });
    await expect(
      engine.search({ q: 'foo', engagementId: '' as never, firmId: 'f', scope: 'questions', k: 10 }),
    ).rejects.toBeInstanceOf(Error);
  });

  it('isolates engagement A from engagement B at the pgvector layer', async () => {
    const sql = new InMemorySql();
    sql.rows.set('claims', [
      { id: 'doc-a', engagementId: 'A', firmId: 'F', embedding: [0.1, 0.2, 0.3], text: 'engagement A claim' },
      { id: 'doc-b', engagementId: 'B', firmId: 'F', embedding: [0.1, 0.2, 0.3], text: 'engagement B claim' },
    ]);
    const pg = new PgVectorAdapter(sql);
    const aHits = await pg.nearestNeighbors({
      spec: { scope: 'questions', table: 'claims', idColumn: 'id', embeddingColumn: 'embedding' },
      vector: [0.1, 0.2, 0.3],
      k: 10,
      engagementId: 'A',
    });
    const bHits = await pg.nearestNeighbors({
      spec: { scope: 'questions', table: 'claims', idColumn: 'id', embeddingColumn: 'embedding' },
      vector: [0.1, 0.2, 0.3],
      k: 10,
      engagementId: 'B',
    });
    expect(aHits.map((h) => h.id)).toEqual(['doc-a']);
    expect(bHits.map((h) => h.id)).toEqual(['doc-b']);
  });
});
