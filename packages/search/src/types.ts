// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

export const SearchScopeSchema = z.enum([
  'all',
  'questions',
  'clauses',
  'probes',
  'evidence',
  'traces',
  'findings',
  'working_papers',
  'catalogues',
]);
export type SearchScope = z.infer<typeof SearchScopeSchema>;

export const SearchFilterSchema = z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]));
export type SearchFilter = z.infer<typeof SearchFilterSchema>;

export const SearchQuerySchema = z.object({
  q: z.string().min(1).max(2000),
  engagementId: z.string().uuid(),
  firmId: z.string().uuid(),
  scope: SearchScopeSchema.default('all'),
  filters: SearchFilterSchema.optional(),
  k: z.number().int().positive().max(200).default(20),
});
export type SearchQuery = z.infer<typeof SearchQuerySchema>;

export interface SearchHit {
  id: string;
  scope: SearchScope;
  score: number;
  bm25Score?: number;
  vectorScore?: number;
  snippet?: string;
  payload: Record<string, unknown>;
}

export interface SearchResult {
  hits: SearchHit[];
  totalEstimated: number;
  tookMs: number;
  modes: ReadonlyArray<'keyword' | 'semantic' | 'hybrid'>;
}

export interface IndexableDocument {
  id: string;
  scope: SearchScope;
  firmId?: string;
  engagementId?: string;
  text: string;
  payload: Record<string, unknown>;
  embedding?: number[];
}

export class SearchScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SearchScopeError';
  }
}

export class MissingEngagementError extends SearchScopeError {
  constructor() {
    super('search rejected: engagementId is required for tenant scoping');
    this.name = 'MissingEngagementError';
  }
}
