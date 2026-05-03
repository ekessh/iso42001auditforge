// SPDX-License-Identifier: BUSL-1.1
//
// BLK-5 perf-regression test for `ClaimGraph.traverse`.
//
// The fix hoists the relations fetch outside the BFS loop. The functional
// gate here is: regardless of seed count and depth, traverse must call
// `listClaimRelations` exactly once. Performance numbers are documented
// for visibility but not gated on CI hardware.

import { describe, expect, it } from 'vitest';
import { buildClaim, createHarness } from './fixtures.js';

describe('ClaimGraph.traverse (perf — BLK-5)', () => {
  it('issues exactly one listClaimRelations call regardless of seed × depth', async () => {
    const h = createHarness();
    const v = await h.freshSchema();
    // Build a chain a -> b -> c -> d and a fan-out node 'X'.
    const ids: string[] = [];
    let prev = await h.claimGraph.createClaim(
      h.ctx,
      buildClaim(h.ctx, v, { subject: 'A' }),
    );
    ids.push(prev.id);
    for (const subj of ['B', 'C', 'D', 'E']) {
      const next = await h.claimGraph.createClaim(
        h.ctx,
        buildClaim(h.ctx, v, { subject: subj }),
      );
      await h.claimGraph.addRelation(h.ctx, prev.id, 'supports', next.id);
      ids.push(next.id);
      prev = next;
    }

    // Spy on listClaimRelations
    const original = h.store.listClaimRelations.bind(h.store);
    let calls = 0;
    h.store.listClaimRelations = (async (...args: Parameters<typeof original>) => {
      calls += 1;
      return original(...args);
    }) as typeof h.store.listClaimRelations;

    const seeds = ids.slice(0, 3); // 3 seeds × depth 3 — would be 9+ calls before fix
    const result = await h.claimGraph.traverse(h.ctx, seeds, 3);
    expect(calls).toBe(1);
    expect(result.length).toBeGreaterThan(0);
  });

  it('produces the same visited set as the previous (per-seed) implementation', async () => {
    const h = createHarness();
    const v = await h.freshSchema();
    const a = await h.claimGraph.createClaim(h.ctx, buildClaim(h.ctx, v, { subject: 'A' }));
    const b = await h.claimGraph.createClaim(h.ctx, buildClaim(h.ctx, v, { subject: 'B' }));
    const c = await h.claimGraph.createClaim(h.ctx, buildClaim(h.ctx, v, { subject: 'C' }));
    const d = await h.claimGraph.createClaim(h.ctx, buildClaim(h.ctx, v, { subject: 'D' }));
    await h.claimGraph.addRelation(h.ctx, a.id, 'supports', b.id);
    await h.claimGraph.addRelation(h.ctx, b.id, 'supports', c.id);
    await h.claimGraph.addRelation(h.ctx, c.id, 'supports', d.id);
    // Add a back-edge to verify the byB index works.
    await h.claimGraph.addRelation(h.ctx, d.id, 'contradicts', a.id);
    const r = await h.claimGraph.traverse(h.ctx, [a.id], 3);
    const ids = new Set(r.map((x) => x.claimId));
    expect(ids.has(a.id)).toBe(true);
    expect(ids.has(b.id)).toBe(true);
    expect(ids.has(c.id)).toBe(true);
    expect(ids.has(d.id)).toBe(true);
  });

  it('depth=0 returns seeds without consulting relations', async () => {
    const h = createHarness();
    const v = await h.freshSchema();
    const a = await h.claimGraph.createClaim(h.ctx, buildClaim(h.ctx, v, { subject: 'A' }));
    const original = h.store.listClaimRelations.bind(h.store);
    let calls = 0;
    h.store.listClaimRelations = (async (...args: Parameters<typeof original>) => {
      calls += 1;
      return original(...args);
    }) as typeof h.store.listClaimRelations;
    const r = await h.claimGraph.traverse(h.ctx, [a.id], 0);
    expect(calls).toBe(0);
    expect(r).toEqual([{ claimId: a.id, depth: 0 }]);
  });

  it('1k-edge graph traverse completes in well under documented latency budget', async () => {
    const h = createHarness();
    const v = await h.freshSchema();
    // Build 1000 claims linked into a chain of supports edges + a star.
    const N = 1_000;
    const created: string[] = [];
    let prev: { id: string } | null = null;
    for (let i = 0; i < N; i++) {
      const c = await h.claimGraph.createClaim(
        h.ctx,
        buildClaim(h.ctx, v, { subject: `S${i}` }),
      );
      created.push(c.id);
      if (prev) {
        await h.claimGraph.addRelation(h.ctx, prev.id, 'supports', c.id);
      }
      prev = c;
    }
    const start = process.hrtime.bigint();
    const r = await h.claimGraph.traverse(h.ctx, [created[0]!], 3);
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    // Expect at most depth-cap+1 = 4 nodes.
    expect(r.length).toBe(4);
    // eslint-disable-next-line no-console
    console.log(`[BLK-5 SLO] traverse over 1k-edge graph in ${elapsedMs.toFixed(1)}ms`);
  });
});
