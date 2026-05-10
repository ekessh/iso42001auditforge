// SPDX-License-Identifier: BUSL-1.1
//
// CLI entry point: `pnpm --filter @auditforge/catalogues reindex`.
//
// Defaults:
//   MEILISEARCH_HOST     http://localhost:7700
//   MEILISEARCH_API_KEY  auditforge_dev_only_master_key
//   OLLAMA_HOST          http://localhost:11434
//   OLLAMA_EMBED_MODEL   nomic-embed-text
//   DATABASE_URL         postgres://auditforge:auditforge_dev_only@localhost:5432/auditforge
//
// The CLI is intentionally light on dependencies: it talks to Meilisearch and
// Ollama via fetch and to Postgres via the workspace's `postgres` driver.

import process from 'node:process';
import { buildAllCatalogueDocuments } from './indexer.js';

interface OllamaEmbedResponse {
  embedding?: number[];
  embeddings?: number[][];
}

class OllamaEmbedder {
  constructor(
    private readonly host: string,
    private readonly model: string,
  ) {}

  async embed(text: string): Promise<number[]> {
    const r = await fetch(`${this.host}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, prompt: text }),
    });
    if (!r.ok) throw new Error(`ollama embed ${r.status}: ${await r.text()}`);
    const body = (await r.json()) as OllamaEmbedResponse;
    return body.embedding ?? body.embeddings?.[0] ?? [];
  }
}

class MeilisearchSink {
  constructor(
    private readonly host: string,
    private readonly apiKey: string,
  ) {}

  async upsert(indexName: string, docs: readonly Record<string, unknown>[]): Promise<void> {
    if (docs.length === 0) return;
    const ensure = await fetch(`${this.host}/indexes`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ uid: indexName, primaryKey: 'id' }),
    });
    if (!ensure.ok && ensure.status !== 409 && ensure.status !== 202) {
      throw new Error(`meili create-index ${ensure.status}: ${await ensure.text()}`);
    }
    await fetch(`${this.host}/indexes/${indexName}/settings/filterable-attributes`, {
      method: 'PUT',
      headers: this.headers(),
      body: JSON.stringify(['engagementId', 'firmId', 'scope', 'tags', 'framework', 'clauseId']),
    });
    const docsRes = await fetch(`${this.host}/indexes/${indexName}/documents`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(docs),
    });
    if (!docsRes.ok) {
      throw new Error(`meili upsert ${docsRes.status}: ${await docsRes.text()}`);
    }
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
    };
  }
}

async function main(): Promise<void> {
  const meiliHost = process.env['MEILISEARCH_HOST'] ?? 'http://localhost:7700';
  const meiliKey = process.env['MEILISEARCH_API_KEY'] ?? '';
  const ollamaHost = process.env['OLLAMA_HOST'] ?? 'http://localhost:11434';
  const embedModel = process.env['OLLAMA_EMBED_MODEL'] ?? 'nomic-embed-text';

  const docs = await buildAllCatalogueDocuments();
  process.stdout.write(`built ${docs.length} catalogue documents\n`);

  const meili = new MeilisearchSink(meiliHost, meiliKey);
  const records = docs.map((d) => ({
    id: stableMeiliId(d.id),
    canonicalId: d.id,
    scope: 'catalogues',
    framework: d.framework,
    title: d.title,
    text: d.text,
    tags: d.tags,
    ...d.payload,
  }));
  await meili.upsert('auditforge-catalogues', records);
  process.stdout.write(`pushed ${records.length} docs to meilisearch index auditforge-catalogues\n`);

  const skipEmbed = process.env['SKIP_EMBED'] === '1';
  if (skipEmbed) {
    process.stdout.write('SKIP_EMBED=1 — skipping embedding step\n');
    return;
  }

  const dbUrl = process.env['DATABASE_URL'];
  if (!dbUrl) {
    process.stdout.write('DATABASE_URL unset — skipping pgvector embedding step\n');
    return;
  }

  // Defer postgres import so the CLI works even when the driver is absent at
  // build time (consumers can pre-build catalogue docs without Postgres).
  const { default: postgres } = await import('postgres');
  const sql = postgres(dbUrl, { prepare: false });
  try {
    const embedder = new OllamaEmbedder(ollamaHost, embedModel);
    let n = 0;
    for (const doc of docs) {
      const nodeId = doc.id.includes(':') ? doc.id.slice(doc.id.indexOf(':') + 1) : doc.id;
      try {
        const vector = await embedder.embed(doc.text);
        if (vector.length === 0) continue;
        const literal = `[${vector.join(',')}]`;
        await sql`INSERT INTO catalogue_embeddings (framework, node_id, embedding, metadata)
                  VALUES (${doc.framework}, ${nodeId}, ${literal}::vector, ${JSON.stringify({ title: doc.title, tags: doc.tags, ...doc.payload })}::jsonb)
                  ON CONFLICT (framework, node_id) DO UPDATE
                    SET embedding = EXCLUDED.embedding,
                        metadata  = EXCLUDED.metadata,
                        updated_at = now()`;
        n++;
        if (n % 25 === 0) process.stdout.write(`  embedded ${n}/${docs.length}\n`);
      } catch (e) {
        process.stderr.write(`  skipped ${doc.id}: ${(e as Error).message}\n`);
      }
    }
    process.stdout.write(`embedded ${n} documents into catalogue_embeddings\n`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

function stableMeiliId(rawId: string): string {
  // Meilisearch primary keys must match /^[A-Za-z0-9_-]+$/. Replace anything
  // outside that set with `_` so framework-prefixed IDs survive.
  return rawId.replace(/[^A-Za-z0-9_-]/g, '_');
}

main().catch((e: unknown) => {
  process.stderr.write(`reindex failed: ${(e as Error).message}\n`);
  process.exit(1);
});
