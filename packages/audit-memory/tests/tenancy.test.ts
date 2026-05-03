// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { TenantViolation, ValidationError } from '@auditforge/shared';
import { buildClaim, createHarness } from './fixtures.js';

describe('Tenant isolation', () => {
  it('blocks reading another engagement\'s claim', async () => {
    const h = createHarness();
    const v = await h.freshSchema();
    const c = await h.claimGraph.createClaim(h.ctx, buildClaim(h.ctx, v));
    await expect(h.claimGraph.getClaim(h.altCtx, c.id)).rejects.toBeInstanceOf(
      TenantViolation,
    );
  });

  it('blocks creating a claim with a tenant-mismatched payload', async () => {
    const h = createHarness();
    const v = await h.freshSchema();
    await expect(
      h.claimGraph.createClaim(
        h.ctx,
        buildClaim(h.ctx, v, { firmId: '00000000-0000-4000-8000-000000000099' }),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('blocks listing claims for a different engagement', async () => {
    const h = createHarness();
    const v = await h.freshSchema();
    await h.claimGraph.createClaim(h.ctx, buildClaim(h.ctx, v));
    const altList = await h.claimGraph.listClaims(h.altCtx);
    expect(altList.length).toBe(0);
  });

  it('blocks listing relations for a different engagement', async () => {
    const h = createHarness();
    const v = await h.freshSchema();
    const a = await h.claimGraph.createClaim(h.ctx, buildClaim(h.ctx, v, { subject: 'A' }));
    const b = await h.claimGraph.createClaim(h.ctx, buildClaim(h.ctx, v, { subject: 'B' }));
    await h.claimGraph.addRelation(h.ctx, a.id, 'supports', b.id);
    const altRels = await h.claimGraph.listRelations(h.altCtx);
    expect(altRels.length).toBe(0);
  });

  it('blocks supersede across engagements', async () => {
    const h = createHarness();
    const v = await h.freshSchema();
    const c = await h.claimGraph.createClaim(h.ctx, buildClaim(h.ctx, v));
    await expect(
      h.claimGraph.supersede(
        h.altCtx,
        c.id,
        '00000000-0000-4000-8000-000000000099',
      ),
    ).rejects.toThrow();
  });
});
