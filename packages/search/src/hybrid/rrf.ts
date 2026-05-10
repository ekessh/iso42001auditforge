// SPDX-License-Identifier: BUSL-1.1
import type { SearchHit } from '../types.js';

export interface RrfFuseOptions {
  k?: number;
}

/**
 * Reciprocal-Rank Fusion. RRF is rank-based, not score-based, so it tolerates
 * the very different score distributions produced by BM25 (Meilisearch) and
 * cosine similarity (pgvector). The constant `k` (default 60) damps the
 * contribution of low-ranked items; lower k weights the head harder.
 */
export function rrfFuse(
  rankedLists: ReadonlyArray<readonly SearchHit[]>,
  options: RrfFuseOptions = {},
): SearchHit[] {
  const k = options.k ?? 60;
  const acc = new Map<string, SearchHit & { rrf: number }>();
  for (const list of rankedLists) {
    list.forEach((hit, idx) => {
      const contribution = 1 / (k + idx + 1);
      const existing = acc.get(hit.id);
      if (existing) {
        existing.rrf += contribution;
        if (hit.bm25Score !== undefined) existing.bm25Score = hit.bm25Score;
        if (hit.vectorScore !== undefined) existing.vectorScore = hit.vectorScore;
        if (existing.snippet === undefined && hit.snippet) existing.snippet = hit.snippet;
        existing.payload = { ...existing.payload, ...hit.payload };
      } else {
        acc.set(hit.id, { ...hit, rrf: contribution });
      }
    });
  }
  return [...acc.values()]
    .sort((a, b) => b.rrf - a.rrf)
    .map(({ rrf, ...rest }) => ({ ...rest, score: rrf }));
}
