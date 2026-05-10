// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { rrfFuse } from '../src/hybrid/rrf.js';
import type { SearchHit } from '../src/types.js';

function hit(id: string, score: number, scope: SearchHit['scope'] = 'all'): SearchHit {
  return { id, score, scope, payload: { id } };
}

describe('rrfFuse', () => {
  it('merges two ranked lists by reciprocal rank', () => {
    const a = [hit('x', 0.9), hit('y', 0.8), hit('z', 0.5)];
    const b = [hit('z', 0.95), hit('x', 0.7), hit('w', 0.6)];
    const fused = rrfFuse([a, b]);
    expect(fused.map((h) => h.id)).toEqual(expect.arrayContaining(['x', 'y', 'z', 'w']));
    // x is rank 0 in list A and rank 1 in list B → very high
    // z is rank 2 in A and rank 0 in B → also high but slightly lower than x
    const xRank = fused.findIndex((h) => h.id === 'x');
    const zRank = fused.findIndex((h) => h.id === 'z');
    expect(xRank).toBeLessThanOrEqual(zRank);
  });

  it('preserves bm25 and vector scores when present', () => {
    const a = [{ ...hit('x', 0.9), bm25Score: 0.9 }];
    const b = [{ ...hit('x', 0.8), vectorScore: 0.8 }];
    const fused = rrfFuse([a, b]);
    expect(fused[0]?.bm25Score).toBe(0.9);
    expect(fused[0]?.vectorScore).toBe(0.8);
  });

  it('handles single-list input gracefully', () => {
    const a = [hit('x', 0.9), hit('y', 0.8)];
    const fused = rrfFuse([a]);
    expect(fused).toHaveLength(2);
    expect(fused[0]?.id).toBe('x');
  });

  it('handles empty input', () => {
    expect(rrfFuse([])).toEqual([]);
    expect(rrfFuse([[]])).toEqual([]);
  });

  it('respects the k constant for damping', () => {
    const a = [hit('top', 0.9), hit('mid', 0.5), hit('low', 0.1)];
    const tightK = rrfFuse([a], { k: 1 });
    const looseK = rrfFuse([a], { k: 1000 });
    // Tighter k pushes the head's score way above the tail.
    const tightSpread = tightK[0]!.score - tightK[2]!.score;
    const looseSpread = looseK[0]!.score - looseK[2]!.score;
    expect(tightSpread).toBeGreaterThan(looseSpread);
  });
});
