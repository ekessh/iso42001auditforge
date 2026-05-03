// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError, ValidationError } from '@auditforge/shared';
import { createHarness } from './fixtures.js';
import { ENTITY_TYPES, RELATION_TYPES } from '../src/index.js';

describe('SchemaRegistry', () => {
  it('seeds the initial schema with all pre-declared entity and relation types', async () => {
    const h = createHarness();
    const v = await h.schemaRegistry.createInitialVersion(h.ctx);
    expect(v.entityTypeNames).toEqual([...ENTITY_TYPES]);
    expect(v.relationTypeNames).toEqual([...RELATION_TYPES]);
    const ets = await h.schemaRegistry.listEntityTypes(h.ctx, v.id);
    expect(ets.map((e) => e.name).sort()).toEqual([...ENTITY_TYPES].sort());
    const rts = await h.schemaRegistry.listRelationTypes(h.ctx, v.id);
    expect(rts.map((r) => r.name).sort()).toEqual([...RELATION_TYPES].sort());
  });

  it('freezes a version and rejects further mutations', async () => {
    const h = createHarness();
    const v = await h.schemaRegistry.createInitialVersion(h.ctx);
    const frozen = await h.schemaRegistry.freezeVersion(h.ctx, v.id);
    expect(frozen.status).toBe('frozen');
    expect(frozen.frozenAt).toBeTruthy();
    await expect(
      h.schemaRegistry.declareEntityType(h.ctx, v.id, 'NewType'),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('declares a new entity type on a draft and validates uniqueness', async () => {
    const h = createHarness();
    const v = await h.schemaRegistry.createInitialVersion(h.ctx);
    const t = await h.schemaRegistry.declareEntityType(h.ctx, v.id, 'CustomType', 'd');
    expect(t.name).toBe('CustomType');
    await expect(
      h.schemaRegistry.declareEntityType(h.ctx, v.id, 'CustomType'),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('declares relation types and rejects duplicates', async () => {
    const h = createHarness();
    const v = await h.schemaRegistry.createInitialVersion(h.ctx);
    const r = await h.schemaRegistry.declareRelationType(h.ctx, v.id, 'links_to');
    expect(r.name).toBe('links_to');
    await expect(
      h.schemaRegistry.declareRelationType(h.ctx, v.id, 'links_to'),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('validates a claim against the active schema and rejects unknown entity types', async () => {
    const h = createHarness();
    const v = await h.freshSchema();
    await expect(
      h.schemaRegistry.validateClaimAgainst(h.ctx, v.id, {
        entityType: 'UFO',
        predicate: 'covers',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects claims with unknown predicate', async () => {
    const h = createHarness();
    const v = await h.freshSchema();
    await expect(
      h.schemaRegistry.validateClaimAgainst(h.ctx, v.id, {
        entityType: 'AISystem',
        predicate: 'mind_melds',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('forks a new draft from a frozen version and copies vocabularies', async () => {
    const h = createHarness();
    const v = await h.freshSchema();
    const draft = await h.schemaRegistry.newDraftFrom(h.ctx, v.id, 'v2');
    expect(draft.parentVersionId).toBe(v.id);
    expect(draft.entityTypeNames.length).toBe(v.entityTypeNames.length);
  });

  it('only allows forking from a frozen version', async () => {
    const h = createHarness();
    const v = await h.schemaRegistry.createInitialVersion(h.ctx);
    await expect(
      h.schemaRegistry.newDraftFrom(h.ctx, v.id, 'v2'),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('throws NotFoundError when freezing an unknown version', async () => {
    const h = createHarness();
    await expect(
      h.schemaRegistry.freezeVersion(h.ctx, '00000000-0000-4000-8000-000000000000'),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('returns the most recently frozen version as active', async () => {
    const h = createHarness();
    const v = await h.freshSchema();
    const active = await h.schemaRegistry.getActive(h.ctx);
    expect(active.id).toBe(v.id);
  });
});
