// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import { TenantContextSchema, UuidSchema } from '@auditforge/shared';
import type { Verdict, WorkingPaper } from './domain.js';

/**
 * SearchIndexer — adapter interface. The hybrid (Meilisearch + pgvector) is
 * implemented in `apps/worker`; this package only ships the contract.
 */
export interface SearchIndexer {
  /** Upsert (full reindex of one WP). Idempotent. */
  upsert(doc: SearchDoc): Promise<void>;
  /** Remove (e.g., on hard delete). */
  remove(workingPaperId: string): Promise<void>;
  /** Run a hybrid query, returning ranked refs. */
  query(q: SearchQuery): Promise<SearchResult>;
}

/**
 * Document shipped to the indexer. The package's registry emits these on every
 * accepted change. Embeddings are computed by the worker (out of scope here);
 * the worker enriches the doc with a vector before pushing to pgvector.
 */
export const SearchDocSchema = z.object({
  id: UuidSchema,
  firmId: UuidSchema,
  engagementId: UuidSchema,
  templateId: z.string().min(1),
  scope: z.object({
    clauseId: z.string().optional(),
    controlId: z.string().optional(),
    aiSystemId: UuidSchema.optional(),
  }),
  verdict: z.string(),
  confidence: z.number().int(),
  /** Full plaintext rendered from the WP body (server-side strips Yjs/HTML). */
  text: z.string(),
  /** Free-form keyword tags surfaced to filters. */
  tags: z.array(z.string()).default([]),
  /** Hash of the doc content — index is skipped if hash unchanged. */
  contentHash: z.string(),
  updatedAt: z.string(),
});
export type SearchDoc = z.infer<typeof SearchDocSchema>;

export const SearchQuerySchema = z.object({
  tenant: TenantContextSchema,
  /** Required — engagement scope is mandatory; cross-engagement search is forbidden. */
  engagementId: UuidSchema,
  text: z.string().min(1).max(2000),
  filters: z
    .object({
      verdict: z.array(z.string()).optional(),
      clauseId: z.string().optional(),
      controlId: z.string().optional(),
      aiSystemId: UuidSchema.optional(),
    })
    .default({}),
  limit: z.number().int().positive().max(100).default(20),
});
export type SearchQuery = z.infer<typeof SearchQuerySchema>;

export interface SearchHit {
  workingPaperId: string;
  score: number;
  verdict: Verdict;
  snippet: string;
}

export interface SearchResult {
  hits: SearchHit[];
  totalEstimated: number;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

export function toSearchDoc(
  wp: WorkingPaper,
  text: string,
  tags: string[] = [],
): SearchDoc {
  const scope: SearchDoc['scope'] = {};
  if (wp.scope.clauseId !== undefined) scope.clauseId = wp.scope.clauseId;
  if (wp.scope.controlId !== undefined) scope.controlId = wp.scope.controlId;
  if (wp.scope.aiSystemId !== undefined) scope.aiSystemId = wp.scope.aiSystemId;
  return SearchDocSchema.parse({
    id: wp.id,
    firmId: wp.firmId,
    engagementId: wp.engagementId,
    templateId: wp.templateId,
    scope,
    verdict: wp.verdict,
    confidence: wp.confidence,
    text,
    tags,
    contentHash: wp.contentHash,
    updatedAt: wp.lastEditedAt,
  });
}

/**
 * In-memory adapter — used by tests and by `apps/api` smoke tests. Performs
 * a lightweight BM25-ish ranking over tokenized text. Production deployments
 * swap this for the real Meilisearch + pgvector implementation.
 */
export class InMemorySearchIndexer implements SearchIndexer {
  private readonly docs = new Map<string, SearchDoc>();

  async upsert(doc: SearchDoc): Promise<void> {
    this.docs.set(doc.id, doc);
  }

  async remove(id: string): Promise<void> {
    this.docs.delete(id);
  }

  async query(q: SearchQuery): Promise<SearchResult> {
    const parsed = SearchQuerySchema.parse(q);
    const terms = tokenize(parsed.text);
    const filterVerdicts = new Set(parsed.filters.verdict ?? []);

    const hits: SearchHit[] = [];
    for (const doc of this.docs.values()) {
      // Tenant + engagement scoping is enforced at the indexer boundary too.
      if (doc.firmId !== parsed.tenant.firmId) continue;
      if (doc.engagementId !== parsed.engagementId) continue;
      if (filterVerdicts.size > 0 && !filterVerdicts.has(doc.verdict)) continue;
      if (
        parsed.filters.clauseId !== undefined &&
        doc.scope.clauseId !== parsed.filters.clauseId
      ) {
        continue;
      }
      if (
        parsed.filters.controlId !== undefined &&
        doc.scope.controlId !== parsed.filters.controlId
      ) {
        continue;
      }
      if (
        parsed.filters.aiSystemId !== undefined &&
        doc.scope.aiSystemId !== parsed.filters.aiSystemId
      ) {
        continue;
      }

      const docTerms = tokenize(doc.text);
      const docTermSet = new Set(docTerms);
      let score = 0;
      for (const t of terms) {
        if (docTermSet.has(t)) score += 1;
        // bonus for tag match
        if (doc.tags.includes(t)) score += 0.5;
      }
      if (score > 0) {
        hits.push({
          workingPaperId: doc.id,
          score,
          verdict: doc.verdict as Verdict,
          snippet: snippetFor(doc.text, terms),
        });
      }
    }
    hits.sort((a, b) => b.score - a.score);
    return {
      hits: hits.slice(0, parsed.limit),
      totalEstimated: hits.length,
    };
  }
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

function snippetFor(text: string, terms: string[]): string {
  const lower = text.toLowerCase();
  for (const t of terms) {
    const idx = lower.indexOf(t);
    if (idx >= 0) {
      const start = Math.max(0, idx - 40);
      const end = Math.min(text.length, idx + 60);
      return text.slice(start, end);
    }
  }
  return text.slice(0, 100);
}
