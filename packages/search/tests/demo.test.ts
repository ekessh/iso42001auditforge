// SPDX-License-Identifier: BUSL-1.1
//
// Demonstration test: drives the hybrid engine end-to-end with stubbed
// Meilisearch + pgvector backends to prove the RRF fusion produces a
// sensible ranking and the API contract round-trips.

import { describe, expect, it } from 'vitest';
import { HybridSearchEngine } from '../src/hybrid/engine.js';
import { MeilisearchAdapter } from '../src/meilisearch/client.js';
import { PgVectorAdapter, type SqlExecutor } from '../src/pgvector/adapter.js';
import type { SearchHit } from '../src/types.js';

const ENGAGEMENT = '11111111-1111-1111-1111-111111111111';
const FIRM = '22222222-2222-2222-2222-222222222222';

function meiliStub(hits: SearchHit[]): MeilisearchAdapter {
  const stub = Object.create(MeilisearchAdapter.prototype) as MeilisearchAdapter;
  Object.assign(stub, {
    resolveIndexName: (s: string) => `auditforge-${s}`,
    search: async () => hits,
  });
  return stub;
}

class PgStub implements SqlExecutor {
  rows: Array<Record<string, unknown>> = [];
  async unsafe<T = Record<string, unknown>>(): Promise<T[]> {
    return this.rows as unknown as T[];
  }
}

describe('hybrid search demo', () => {
  it('answers "AI risk treatment" with fused clause + claim hits', async () => {
    const meiliHits: SearchHit[] = [
      { id: 'ISO_42001_6_1_3', scope: 'catalogues', score: 1, bm25Score: 1, snippet: 'ISO 42001 clause 6.1.3 AI risk treatment', payload: { framework: 'ISO_42001', nodeId: '6.1.3' } },
      { id: 'NIST_AI_RMF_MANAGE-1.4', scope: 'catalogues', score: 0.7, bm25Score: 0.7, payload: { framework: 'NIST_AI_RMF', nodeId: 'MANAGE-1.4' } },
    ];
    const pgStub = new PgStub();
    pgStub.rows = [
      { id: 'claim-001', score: 0.92, snippet: 'auditee describes their risk treatment workflow' },
      { id: 'ISO_42001_6_1_3', score: 0.85, snippet: 'ISO 42001 clause 6.1.3 AI risk treatment' },
    ];
    const engine = new HybridSearchEngine({
      meilisearch: meiliStub(meiliHits),
      pgvector: new PgVectorAdapter(pgStub),
      embedder: { embed: async () => Array.from({ length: 8 }, (_, i) => i / 10) },
      scopes: [
        { scope: 'catalogues', meiliEnabled: true, pgSpec: { scope: 'catalogues', table: 'catalogue_embeddings', idColumn: 'id', embeddingColumn: 'embedding' } },
      ],
    });
    const out = await engine.search({
      q: 'AI risk treatment',
      scope: 'catalogues',
      k: 5,
      engagementId: ENGAGEMENT,
      firmId: FIRM,
    });

    // The hit that appears in both Meilisearch (BM25) and pgvector (cosine)
    // should outrank the single-source hits.
    expect(out.hits[0]?.id).toBe('ISO_42001_6_1_3');
    expect(out.hits.length).toBeGreaterThanOrEqual(3);
    expect(out.modes).toEqual(['hybrid']);

    // Sample wire-format output (used by the controller as the response body).
    const sample = JSON.stringify(out.hits.slice(0, 3).map((h) => ({ id: h.id, score: Number(h.score.toFixed(4)) })));
    expect(sample).toMatch(/ISO_42001_6_1_3/);
  });
});
