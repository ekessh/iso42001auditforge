// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { buildClaim, createHarness } from './fixtures.js';

describe('PointInTimeQuery', () => {
  it('returns active claims at the given AS-OF time', async () => {
    const h = createHarness('2030-01-01T00:00:00.000Z');
    const v = await h.freshSchema();
    const c = await h.claimGraph.createClaim(
      h.ctx,
      buildClaim(h.ctx, v, { eventTimeStart: '2030-01-01T00:00:00.000Z' }),
    );
    const before = await h.pointInTime.asOf(h.ctx, '2029-12-31T23:59:59.999Z');
    expect(before).toEqual([]);
    const after = await h.pointInTime.asOf(h.ctx, '2030-02-01T00:00:00.000Z');
    expect(after.length).toBe(1);
    expect(after[0]?.id).toBe(c.id);
  });

  it('reproduces the pre-invalidation state for a claim that has been invalidated', async () => {
    const h = createHarness('2030-01-01T00:00:00.000Z');
    const v = await h.freshSchema();
    const c = await h.claimGraph.createClaim(
      h.ctx,
      buildClaim(h.ctx, v, { eventTimeStart: '2030-01-01T00:00:00.000Z' }),
    );
    h.clock.set('2030-06-01T00:00:00.000Z');
    await h.claimGraph.invalidate(h.ctx, c.id, 'retracted');
    const beforeInvalidation = await h.pointInTime.asOf(h.ctx, '2030-04-01T00:00:00.000Z');
    expect(beforeInvalidation.length).toBe(1);
    expect(beforeInvalidation[0]?.validity).toBe('active');
    const afterInvalidation = await h.pointInTime.asOf(h.ctx, '2030-07-01T00:00:00.000Z');
    expect(afterInvalidation.length).toBe(0);
  });

  it('honors includeAllStatuses to surface invalidated claims', async () => {
    const h = createHarness('2030-01-01T00:00:00.000Z');
    const v = await h.freshSchema();
    const c = await h.claimGraph.createClaim(h.ctx, buildClaim(h.ctx, v));
    h.clock.set('2030-06-01T00:00:00.000Z');
    await h.claimGraph.invalidate(h.ctx, c.id, 'r');
    const all = await h.pointInTime.asOf(h.ctx, '2030-12-01T00:00:00.000Z', {
      includeAllStatuses: true,
    });
    expect(all.length).toBe(1);
    expect(all[0]?.validity).toBe('invalidated');
  });

  it('throws on invalid timestamps', async () => {
    const h = createHarness();
    await expect(h.pointInTime.asOf(h.ctx, 'not-a-date')).rejects.toThrow();
  });

  it('excludes claims whose ingestion is later than the AS-OF time', async () => {
    const h = createHarness('2030-01-01T00:00:00.000Z');
    const v = await h.freshSchema();
    h.clock.set('2030-06-01T00:00:00.000Z');
    await h.claimGraph.createClaim(
      h.ctx,
      buildClaim(h.ctx, v, { eventTimeStart: '2030-01-01T00:00:00.000Z' }),
    );
    const earlier = await h.pointInTime.asOf(h.ctx, '2030-03-01T00:00:00.000Z');
    expect(earlier.length).toBe(0);
  });
});
