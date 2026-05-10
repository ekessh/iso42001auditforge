// SPDX-License-Identifier: BUSL-1.1
import type { SearchHit, SearchScope } from '../types.js';

export interface SqlExecutor {
  unsafe<T = Record<string, unknown>>(query: string, params?: unknown[]): Promise<T[]>;
}

export interface PgVectorTableSpec {
  scope: SearchScope;
  table: string;
  idColumn: string;
  embeddingColumn: string;
  textColumn?: string;
  tenantColumn?: string;
  engagementColumn?: string;
}

export interface NearestNeighborOpts {
  spec: PgVectorTableSpec;
  vector: number[];
  k: number;
  engagementId: string;
  firmId?: string;
  extraSql?: string;
  extraParams?: readonly unknown[];
}

export class PgVectorAdapter {
  constructor(private readonly sql: SqlExecutor) {}

  async embedAndStore(spec: PgVectorTableSpec, id: string, vector: number[]): Promise<void> {
    const literal = vectorLiteral(vector);
    const q = `UPDATE ${ident(spec.table)} SET ${ident(spec.embeddingColumn)} = $1::vector WHERE ${ident(spec.idColumn)} = $2`;
    await this.sql.unsafe(q, [literal, id]);
  }

  async upsertCatalogueEmbedding(
    framework: string,
    nodeId: string,
    vector: number[],
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    const literal = vectorLiteral(vector);
    const q = `INSERT INTO catalogue_embeddings (framework, node_id, embedding, metadata)
               VALUES ($1, $2, $3::vector, $4::jsonb)
               ON CONFLICT (framework, node_id) DO UPDATE
                 SET embedding = EXCLUDED.embedding,
                     metadata  = EXCLUDED.metadata,
                     updated_at = now()`;
    await this.sql.unsafe(q, [framework, nodeId, literal, JSON.stringify(metadata)]);
  }

  async nearestNeighbors(opts: NearestNeighborOpts): Promise<SearchHit[]> {
    const literal = vectorLiteral(opts.vector);
    const params: unknown[] = [literal, opts.engagementId];
    let where = `${ident(opts.spec.engagementColumn ?? 'engagement_id')} = $2`;
    if (opts.firmId !== undefined && opts.spec.tenantColumn !== undefined) {
      params.push(opts.firmId);
      where += ` AND ${ident(opts.spec.tenantColumn)} = $${params.length}`;
    }
    if (opts.extraSql !== undefined) {
      where += ` AND ${opts.extraSql}`;
      if (opts.extraParams) params.push(...opts.extraParams);
    }
    params.push(opts.k);
    const limitParamIndex = params.length;
    const textCol = opts.spec.textColumn ?? 'object_text';
    const q = `SELECT ${ident(opts.spec.idColumn)} AS id,
                      ${ident(textCol)} AS snippet,
                      1 - (${ident(opts.spec.embeddingColumn)} <=> $1::vector) AS score
                 FROM ${ident(opts.spec.table)}
                WHERE ${where}
                  AND ${ident(opts.spec.embeddingColumn)} IS NOT NULL
                ORDER BY ${ident(opts.spec.embeddingColumn)} <=> $1::vector ASC
                LIMIT $${limitParamIndex}`;
    const rows = await this.sql.unsafe<Record<string, unknown>>(q, params);
    return rows.map((r) => {
      const hit: SearchHit = {
        id: String(r['id']),
        scope: opts.spec.scope,
        score: Number(r['score'] ?? 0),
        vectorScore: Number(r['score'] ?? 0),
        payload: r,
      };
      if (typeof r['snippet'] === 'string') hit.snippet = r['snippet'];
      return hit;
    });
  }

  async catalogueNearestNeighbors(
    vector: number[],
    k: number,
    framework?: string,
  ): Promise<SearchHit[]> {
    const literal = vectorLiteral(vector);
    const params: unknown[] = [literal];
    let where = '';
    if (framework !== undefined) {
      params.push(framework);
      where = `WHERE framework = $${params.length}`;
    }
    params.push(k);
    const limitParamIndex = params.length;
    const q = `SELECT id, framework, node_id, metadata,
                      1 - (embedding <=> $1::vector) AS score
                 FROM catalogue_embeddings
                 ${where}
                 ORDER BY embedding <=> $1::vector ASC
                 LIMIT $${limitParamIndex}`;
    const rows = await this.sql.unsafe<Record<string, unknown>>(q, params);
    return rows.map((r) => ({
      id: String(r['node_id']),
      scope: 'catalogues' as SearchScope,
      score: Number(r['score'] ?? 0),
      vectorScore: Number(r['score'] ?? 0),
      payload: r,
    }));
  }
}

function vectorLiteral(v: readonly number[]): string {
  // pgvector accepts the bracketed literal form. Stringifying numbers locally
  // avoids one round-trip through postgres-js parameter type inference.
  return `[${v.map((x) => Number.isFinite(x) ? x.toString() : '0').join(',')}]`;
}

function ident(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`unsafe SQL identifier: ${name}`);
  }
  return `"${name}"`;
}
