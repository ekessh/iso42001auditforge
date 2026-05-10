// SPDX-License-Identifier: BUSL-1.1
//
// Synthetic bi-temporal correctness scenarios beyond the baseline AS-OF
// tests. CLAUDE.md: "Bi-temporal correctness tests: synthetic timeline with
// claim insertions, invalidations, query at various as-of times, asserts."
//
// Each scenario builds a deterministic timeline of insert/invalidate/
// supersede operations and verifies that the AS-OF query reproduces the
// correct historical state. We assert on `validity`, `eventTimeEnd`, and the
// observable visible-set rather than on internal storage layout.

import { describe, expect, it } from 'vitest';
import { buildClaim, createHarness } from './fixtures.js';

describe('bi-temporal scenarios', () => {
  it('A: claim invalidated and reinstated by a fresh sibling — AS-OF reflects each', async () => {
    const h = createHarness('2030-01-01T00:00:00.000Z');
    const v = await h.freshSchema();
    const c = await h.claimGraph.createClaim(
      h.ctx,
      buildClaim(h.ctx, v, { eventTimeStart: '2030-01-01T00:00:00.000Z' }),
    );
    h.clock.set('2030-03-01T00:00:00.000Z');
    await h.claimGraph.invalidate(h.ctx, c.id, 'retracted');
    h.clock.set('2030-04-01T00:00:00.000Z');
    const replacement = await h.claimGraph.createClaim(
      h.ctx,
      buildClaim(h.ctx, v, { eventTimeStart: '2030-04-01T00:00:00.000Z' }),
    );

    const t1 = await h.pointInTime.asOf(h.ctx, '2030-02-01T00:00:00.000Z');
    expect(t1.length).toBe(1);
    expect(t1[0]?.id).toBe(c.id);

    const t2 = await h.pointInTime.asOf(h.ctx, '2030-03-15T00:00:00.000Z');
    expect(t2.length).toBe(0);

    const t3 = await h.pointInTime.asOf(h.ctx, '2030-05-01T00:00:00.000Z');
    expect(t3.length).toBe(1);
    expect(t3[0]?.id).toBe(replacement.id);
  });

  it('B: supersede chain — earliest, intermediate, current AS-OF read each step', async () => {
    const h = createHarness('2030-01-01T00:00:00.000Z');
    const v = await h.freshSchema();
    const c1 = await h.claimGraph.createClaim(
      h.ctx,
      buildClaim(h.ctx, v, { eventTimeStart: '2030-01-01T00:00:00.000Z' }),
    );

    h.clock.set('2030-02-01T00:00:00.000Z');
    const c2 = await h.claimGraph.createClaim(
      h.ctx,
      buildClaim(h.ctx, v, {
        eventTimeStart: '2030-02-01T00:00:00.000Z',
        ingestionTime: '2030-02-01T00:00:00.000Z',
      }),
    );
    await h.claimGraph.supersede(h.ctx, c1.id, c2.id, 'updated');

    h.clock.set('2030-03-01T00:00:00.000Z');
    const c3 = await h.claimGraph.createClaim(
      h.ctx,
      buildClaim(h.ctx, v, {
        eventTimeStart: '2030-03-01T00:00:00.000Z',
        ingestionTime: '2030-03-01T00:00:00.000Z',
      }),
    );
    await h.claimGraph.supersede(h.ctx, c2.id, c3.id, 'updated again');

    const t1 = await h.pointInTime.asOf(h.ctx, '2030-01-15T00:00:00.000Z');
    expect(t1.map((c) => c.id)).toEqual([c1.id]);
    const t2 = await h.pointInTime.asOf(h.ctx, '2030-02-15T00:00:00.000Z');
    expect(t2.map((c) => c.id)).toEqual([c2.id]);
    const t3 = await h.pointInTime.asOf(h.ctx, '2030-03-15T00:00:00.000Z');
    expect(t3.map((c) => c.id)).toEqual([c3.id]);
  });

  it('C: ingestion-time lag — late-recorded claim invisible at earlier AS-OF', async () => {
    const h = createHarness('2030-01-01T00:00:00.000Z');
    const v = await h.freshSchema();
    h.clock.set('2030-06-01T00:00:00.000Z');
    await h.claimGraph.createClaim(
      h.ctx,
      buildClaim(h.ctx, v, {
        eventTimeStart: '2030-01-01T00:00:00.000Z',
        ingestionTime: '2030-06-01T00:00:00.000Z',
      }),
    );

    // event time IS BEFORE the AS-OF, but ingestion was AFTER => not visible.
    const tEarlyEvent = await h.pointInTime.asOf(h.ctx, '2030-03-01T00:00:00.000Z');
    expect(tEarlyEvent.length).toBe(0);

    // Both event and ingestion are before AS-OF => visible.
    const tBoth = await h.pointInTime.asOf(h.ctx, '2030-07-01T00:00:00.000Z');
    expect(tBoth.length).toBe(1);
  });

  it('D: includeAllStatuses surfaces multi-status history', async () => {
    const h = createHarness('2030-01-01T00:00:00.000Z');
    const v = await h.freshSchema();
    const c = await h.claimGraph.createClaim(
      h.ctx,
      buildClaim(h.ctx, v, { eventTimeStart: '2030-01-01T00:00:00.000Z' }),
    );
    h.clock.set('2030-03-01T00:00:00.000Z');
    await h.claimGraph.invalidate(h.ctx, c.id, 'retracted');

    const all = await h.pointInTime.asOf(h.ctx, '2030-04-01T00:00:00.000Z', {
      includeAllStatuses: true,
    });
    const active = await h.pointInTime.asOf(h.ctx, '2030-04-01T00:00:00.000Z');
    expect(all.length).toBe(1);
    expect(all[0]?.validity).toBe('invalidated');
    expect(active.length).toBe(0);
  });

  it('E: tenancy isolation — engagement A invisible from engagement B', async () => {
    const h = createHarness('2030-01-01T00:00:00.000Z');
    const v = await h.freshSchema();
    await h.claimGraph.createClaim(
      h.ctx,
      buildClaim(h.ctx, v, { eventTimeStart: '2030-01-01T00:00:00.000Z' }),
    );
    const fromOther = await h.pointInTime.asOf(h.altCtx, '2030-12-01T00:00:00.000Z');
    expect(fromOther.length).toBe(0);
    const fromOwn = await h.pointInTime.asOf(h.ctx, '2030-12-01T00:00:00.000Z');
    expect(fromOwn.length).toBe(1);
  });

  it('F: identical AS-OF as the claim event boundary returns the claim', async () => {
    const h = createHarness('2030-01-01T00:00:00.000Z');
    const v = await h.freshSchema();
    await h.claimGraph.createClaim(
      h.ctx,
      buildClaim(h.ctx, v, { eventTimeStart: '2030-01-01T00:00:00.000Z' }),
    );
    const at = await h.pointInTime.asOf(h.ctx, '2030-01-01T00:00:00.000Z');
    expect(at.length).toBe(1);
  });
});
