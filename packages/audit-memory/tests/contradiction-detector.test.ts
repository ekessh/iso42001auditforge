// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { buildClaim, createHarness } from './fixtures.js';

describe('ContradictionDetector', () => {
  it('flags a claim that disagrees on object for the same subject+predicate', async () => {
    const h = createHarness();
    const v = await h.freshSchema();
    await h.claimGraph.createClaim(
      h.ctx,
      buildClaim(h.ctx, v, { subject: 'AISystem:credit', predicate: 'covers', object: 'Clause:6.1.2' }),
    );
    const matches = await h.contradictionDetector.detect(h.ctx, {
      subject: 'AISystem:credit',
      predicate: 'covers',
      object: 'Clause:7.4',
    });
    expect(matches.length).toBe(1);
    expect(matches[0]?.via).toBe('subject_predicate_disagreement');
  });

  it('does not flag claims with the same object', async () => {
    const h = createHarness();
    const v = await h.freshSchema();
    await h.claimGraph.createClaim(
      h.ctx,
      buildClaim(h.ctx, v, { subject: 'A', predicate: 'covers', object: 'X' }),
    );
    const matches = await h.contradictionDetector.detect(h.ctx, {
      subject: 'A',
      predicate: 'covers',
      object: 'X',
    });
    expect(matches.length).toBe(0);
  });

  it('does not flag invalidated claims', async () => {
    const h = createHarness();
    const v = await h.freshSchema();
    const c = await h.claimGraph.createClaim(
      h.ctx,
      buildClaim(h.ctx, v, { subject: 'A', predicate: 'covers', object: 'X' }),
    );
    await h.claimGraph.invalidate(h.ctx, c.id, 'wrong');
    const matches = await h.contradictionDetector.detect(h.ctx, {
      subject: 'A',
      predicate: 'covers',
      object: 'Y',
    });
    expect(matches.length).toBe(0);
  });

  it('finds contradictions via explicit contradicts edges', async () => {
    const h = createHarness();
    const v = await h.freshSchema();
    const a = await h.claimGraph.createClaim(
      h.ctx,
      buildClaim(h.ctx, v, { subject: 'A', predicate: 'covers', object: 'X' }),
    );
    const b = await h.claimGraph.createClaim(
      h.ctx,
      buildClaim(h.ctx, v, { subject: 'B', predicate: 'covers', object: 'Y' }),
    );
    await h.claimGraph.addRelation(h.ctx, a.id, 'contradicts', b.id, 'logical conflict');
    const matches = await h.contradictionDetector.detect(h.ctx, {
      id: a.id,
      subject: a.subject,
      predicate: a.predicate,
      object: a.object,
    });
    expect(matches.length).toBe(1);
    expect(matches[0]?.via).toBe('explicit_contradiction_edge');
    expect(matches[0]?.claim.id).toBe(b.id);
  });

  it('does not double-count when both subject_predicate AND explicit edge match', async () => {
    const h = createHarness();
    const v = await h.freshSchema();
    const a = await h.claimGraph.createClaim(
      h.ctx,
      buildClaim(h.ctx, v, { subject: 'A', predicate: 'covers', object: 'X' }),
    );
    const b = await h.claimGraph.createClaim(
      h.ctx,
      buildClaim(h.ctx, v, { subject: 'A', predicate: 'covers', object: 'Y' }),
    );
    await h.claimGraph.addRelation(h.ctx, a.id, 'contradicts', b.id);
    const matches = await h.contradictionDetector.detect(h.ctx, {
      id: a.id,
      subject: a.subject,
      predicate: a.predicate,
      object: a.object,
    });
    expect(matches.length).toBe(1);
  });

  it('does not flag the candidate against itself', async () => {
    const h = createHarness();
    const v = await h.freshSchema();
    const a = await h.claimGraph.createClaim(
      h.ctx,
      buildClaim(h.ctx, v, { subject: 'A', predicate: 'covers', object: 'X' }),
    );
    const matches = await h.contradictionDetector.detect(h.ctx, {
      id: a.id,
      subject: a.subject,
      predicate: a.predicate,
      object: a.object,
    });
    expect(matches.length).toBe(0);
  });
});
