// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { PgVectorAdapter, type SqlExecutor } from '../src/pgvector/adapter.js';

class RecordingSql implements SqlExecutor {
  calls: Array<{ q: string; params?: unknown[] }> = [];
  rows: Array<Record<string, unknown>> = [];
  async unsafe<T = Record<string, unknown>>(q: string, params?: unknown[]): Promise<T[]> {
    this.calls.push({ q, ...(params !== undefined ? { params } : {}) });
    return this.rows as unknown as T[];
  }
}

describe('PgVectorAdapter', () => {
  it('embedAndStore issues a vector cast UPDATE', async () => {
    const sql = new RecordingSql();
    const pg = new PgVectorAdapter(sql);
    await pg.embedAndStore(
      { scope: 'questions', table: 'claims', idColumn: 'id', embeddingColumn: 'embedding' },
      'abc',
      [0.1, 0.2, 0.3],
    );
    expect(sql.calls[0]?.q).toContain('UPDATE "claims"');
    expect(sql.calls[0]?.q).toContain('"embedding" = $1::vector');
    expect(sql.calls[0]?.params?.[0]).toBe('[0.1,0.2,0.3]');
  });

  it('rejects unsafe identifiers', async () => {
    const pg = new PgVectorAdapter(new RecordingSql());
    await expect(
      pg.embedAndStore(
        { scope: 'questions', table: 'claims; DROP', idColumn: 'id', embeddingColumn: 'embedding' },
        'x',
        [0],
      ),
    ).rejects.toThrow(/unsafe SQL identifier/);
  });

  it('upsertCatalogueEmbedding uses ON CONFLICT', async () => {
    const sql = new RecordingSql();
    const pg = new PgVectorAdapter(sql);
    await pg.upsertCatalogueEmbedding('ISO_42001', '6.1.2', [0.1, 0.2], { weight: 1.5 });
    expect(sql.calls[0]?.q).toContain('catalogue_embeddings');
    expect(sql.calls[0]?.q).toContain('ON CONFLICT (framework, node_id)');
  });

  it('nearestNeighbors filters by engagement_id', async () => {
    const sql = new RecordingSql();
    sql.rows = [{ id: 'r1', score: 0.9, snippet: 'foo' }];
    const pg = new PgVectorAdapter(sql);
    const hits = await pg.nearestNeighbors({
      spec: { scope: 'questions', table: 'claims', idColumn: 'id', embeddingColumn: 'embedding' },
      vector: [0.1, 0.2],
      k: 5,
      engagementId: '11111111-1111-1111-1111-111111111111',
    });
    expect(hits).toHaveLength(1);
    expect(sql.calls[0]?.q).toContain('"engagement_id" = $2');
    expect(hits[0]?.score).toBeCloseTo(0.9);
  });

  it('catalogueNearestNeighbors filters by framework when given', async () => {
    const sql = new RecordingSql();
    sql.rows = [
      { id: 'e1', node_id: '6.1.2', framework: 'ISO_42001', score: 0.8 },
    ];
    const pg = new PgVectorAdapter(sql);
    const hits = await pg.catalogueNearestNeighbors([0.1], 5, 'ISO_42001');
    expect(sql.calls[0]?.q).toContain('WHERE framework = $2');
    expect(hits[0]?.id).toBe('6.1.2');
  });
});
