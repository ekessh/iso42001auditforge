// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError, ValidationError } from '@auditforge/shared';
import { buildClaim, createHarness } from './fixtures.js';

describe('ClaimGraph', () => {
  it('creates a claim with active validity and writes a temporal record', async () => {
    const h = createHarness();
    const v = await h.freshSchema();
    const c = await h.claimGraph.createClaim(h.ctx, buildClaim(h.ctx, v));
    expect(c.validity).toBe('active');
    const history = await h.store.listClaimTemporal(h.ctx, c.id);
    expect(history.length).toBe(1);
    expect(history[0]?.validity).toBe('active');
  });

  it('rejects claims whose entity type is not declared in the schema', async () => {
    const h = createHarness();
    const v = await h.freshSchema();
    await expect(
      h.claimGraph.createClaim(h.ctx, buildClaim(h.ctx, v, { entityType: 'Alien' })),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('invalidates a claim, sets eventTimeEnd and records temporal history', async () => {
    const h = createHarness('2030-01-01T00:00:00.000Z');
    const v = await h.freshSchema();
    const c = await h.claimGraph.createClaim(h.ctx, buildClaim(h.ctx, v));
    h.clock.set('2030-06-01T00:00:00.000Z');
    const inv = await h.claimGraph.invalidate(h.ctx, c.id, 'auditee retraction');
    expect(inv.validity).toBe('invalidated');
    expect(inv.eventTimeEnd).toBe('2030-06-01T00:00:00.000Z');
    const hist = await h.store.listClaimTemporal(h.ctx, c.id);
    expect(hist.map((s) => s.validity)).toEqual(['active', 'invalidated']);
  });

  it('refuses to invalidate a non-active claim', async () => {
    const h = createHarness();
    const v = await h.freshSchema();
    const c = await h.claimGraph.createClaim(h.ctx, buildClaim(h.ctx, v));
    await h.claimGraph.invalidate(h.ctx, c.id, 'r1');
    await expect(h.claimGraph.invalidate(h.ctx, c.id, 'r2')).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it('supersedes an old claim and creates a supersedes ClaimRelation edge', async () => {
    const h = createHarness();
    const v = await h.freshSchema();
    const oldClaim = await h.claimGraph.createClaim(h.ctx, buildClaim(h.ctx, v));
    const newClaim = await h.claimGraph.createClaim(
      h.ctx,
      buildClaim(h.ctx, v, { object: 'Clause:7.4' }),
    );
    const r = await h.claimGraph.supersede(h.ctx, oldClaim.id, newClaim.id, 'updated');
    expect(r.old.validity).toBe('superseded');
    expect(r.relation.relation).toBe('supersedes');
    expect(r.relation.claimAId).toBe(newClaim.id);
    expect(r.relation.claimBId).toBe(oldClaim.id);
  });

  it('rejects superseding a claim with itself', async () => {
    const h = createHarness();
    const v = await h.freshSchema();
    const c = await h.claimGraph.createClaim(h.ctx, buildClaim(h.ctx, v));
    await expect(
      h.claimGraph.supersede(h.ctx, c.id, c.id),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects supersede when the old claim is unknown', async () => {
    const h = createHarness();
    const v = await h.freshSchema();
    const c = await h.claimGraph.createClaim(h.ctx, buildClaim(h.ctx, v));
    await expect(
      h.claimGraph.supersede(h.ctx, '00000000-0000-4000-8000-000000000000', c.id),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('addRelation validates that both endpoints exist', async () => {
    const h = createHarness();
    const v = await h.freshSchema();
    const c = await h.claimGraph.createClaim(h.ctx, buildClaim(h.ctx, v));
    await expect(
      h.claimGraph.addRelation(
        h.ctx,
        c.id,
        'supports',
        '00000000-0000-4000-8000-000000000000',
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('graph traversal respects the depth cap (<=3)', async () => {
    const h = createHarness();
    const v = await h.freshSchema();
    const a = await h.claimGraph.createClaim(h.ctx, buildClaim(h.ctx, v, { subject: 'A' }));
    const b = await h.claimGraph.createClaim(h.ctx, buildClaim(h.ctx, v, { subject: 'B' }));
    const c = await h.claimGraph.createClaim(h.ctx, buildClaim(h.ctx, v, { subject: 'C' }));
    const d = await h.claimGraph.createClaim(h.ctx, buildClaim(h.ctx, v, { subject: 'D' }));
    const e = await h.claimGraph.createClaim(h.ctx, buildClaim(h.ctx, v, { subject: 'E' }));
    await h.claimGraph.addRelation(h.ctx, a.id, 'supports', b.id);
    await h.claimGraph.addRelation(h.ctx, b.id, 'supports', c.id);
    await h.claimGraph.addRelation(h.ctx, c.id, 'supports', d.id);
    await h.claimGraph.addRelation(h.ctx, d.id, 'supports', e.id);
    const result = await h.claimGraph.traverse(h.ctx, [a.id], 3);
    const ids = new Set(result.map((r) => r.claimId));
    expect(ids.has(d.id)).toBe(true);
    expect(ids.has(e.id)).toBe(false);
    expect(ids.size).toBe(4);
  });

  it('graph traversal clamps maxDepth to 3', async () => {
    const h = createHarness();
    const v = await h.freshSchema();
    const a = await h.claimGraph.createClaim(h.ctx, buildClaim(h.ctx, v, { subject: 'A' }));
    const b = await h.claimGraph.createClaim(h.ctx, buildClaim(h.ctx, v, { subject: 'B' }));
    const c = await h.claimGraph.createClaim(h.ctx, buildClaim(h.ctx, v, { subject: 'C' }));
    const d = await h.claimGraph.createClaim(h.ctx, buildClaim(h.ctx, v, { subject: 'D' }));
    const e = await h.claimGraph.createClaim(h.ctx, buildClaim(h.ctx, v, { subject: 'E' }));
    await h.claimGraph.addRelation(h.ctx, a.id, 'supports', b.id);
    await h.claimGraph.addRelation(h.ctx, b.id, 'supports', c.id);
    await h.claimGraph.addRelation(h.ctx, c.id, 'supports', d.id);
    await h.claimGraph.addRelation(h.ctx, d.id, 'supports', e.id);
    const result = await h.claimGraph.traverse(h.ctx, [a.id], 99);
    const ids = new Set(result.map((r) => r.claimId));
    expect(ids.has(e.id)).toBe(false);
  });

  it('rejects negative traversal depth', async () => {
    const h = createHarness();
    await expect(h.claimGraph.traverse(h.ctx, [], -1)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});
