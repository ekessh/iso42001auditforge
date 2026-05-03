// SPDX-License-Identifier: BUSL-1.1
import { ConflictError, NotFoundError, ValidationError } from '@auditforge/shared';
import type { EngagementContext } from '../domain/tenant.js';
import {
  EntityTypeSchema,
  RelationTypeSchema,
  SchemaVersionSchema,
} from '../domain/schema-version.js';
import type {
  EntityType,
  RelationType,
  SchemaVersion,
} from '../domain/schema-version.js';
import {
  ENTITY_TYPES,
  RELATION_TYPES,
  INITIAL_SCHEMA_VERSION_NAME,
} from '../schema/initial.js';
import type { AuditMemoryStore } from '../adapters/store.js';
import type { Clock } from './clock.js';
import type { IdFactory } from './id.js';

export interface SchemaRegistryDeps {
  store: AuditMemoryStore;
  clock: Clock;
  ids: IdFactory;
}

export class SchemaRegistry {
  constructor(private readonly deps: SchemaRegistryDeps) {}

  async createInitialVersion(ctx: EngagementContext): Promise<SchemaVersion> {
    const id = this.deps.ids.uuid();
    const now = this.deps.clock.nowIso();
    const version: SchemaVersion = SchemaVersionSchema.parse({
      id,
      firmId: ctx.firmId,
      engagementId: ctx.engagementId,
      name: INITIAL_SCHEMA_VERSION_NAME,
      status: 'draft',
      parentVersionId: null,
      entityTypeNames: [...ENTITY_TYPES],
      relationTypeNames: [...RELATION_TYPES],
      frozenAt: null,
      createdAt: now,
    });
    await this.deps.store.createSchemaVersion(ctx, version);

    for (const name of ENTITY_TYPES) {
      const et: EntityType = EntityTypeSchema.parse({
        id: this.deps.ids.uuid(),
        firmId: ctx.firmId,
        engagementId: ctx.engagementId,
        schemaVersionId: id,
        name,
        description: '',
        createdAt: now,
      });
      await this.deps.store.insertEntityType(ctx, et);
    }
    for (const name of RELATION_TYPES) {
      const rt: RelationType = RelationTypeSchema.parse({
        id: this.deps.ids.uuid(),
        firmId: ctx.firmId,
        engagementId: ctx.engagementId,
        schemaVersionId: id,
        name,
        symmetric: name === 'contradicts',
        description: '',
        createdAt: now,
      });
      await this.deps.store.insertRelationType(ctx, rt);
    }
    return version;
  }

  async declareEntityType(
    ctx: EngagementContext,
    schemaVersionId: string,
    name: string,
    description = '',
  ): Promise<EntityType> {
    const version = await this.deps.store.getSchemaVersion(ctx, schemaVersionId);
    if (!version) throw new NotFoundError('SchemaVersion', schemaVersionId);
    if (version.status === 'frozen' || version.status === 'archived') {
      throw new ConflictError(`schema version ${version.name} is ${version.status}; declare on a draft`);
    }
    const existing = await this.deps.store.listEntityTypesForVersion(ctx, schemaVersionId);
    if (existing.some((e) => e.name === name)) {
      throw new ConflictError(`entity type already declared: ${name}`);
    }
    const et: EntityType = EntityTypeSchema.parse({
      id: this.deps.ids.uuid(),
      firmId: ctx.firmId,
      engagementId: ctx.engagementId,
      schemaVersionId,
      name,
      description,
      createdAt: this.deps.clock.nowIso(),
    });
    await this.deps.store.insertEntityType(ctx, et);
    return et;
  }

  async declareRelationType(
    ctx: EngagementContext,
    schemaVersionId: string,
    name: string,
    opts: { symmetric?: boolean; description?: string } = {},
  ): Promise<RelationType> {
    const version = await this.deps.store.getSchemaVersion(ctx, schemaVersionId);
    if (!version) throw new NotFoundError('SchemaVersion', schemaVersionId);
    if (version.status === 'frozen' || version.status === 'archived') {
      throw new ConflictError(`schema version ${version.name} is ${version.status}; declare on a draft`);
    }
    const existing = await this.deps.store.listRelationTypesForVersion(ctx, schemaVersionId);
    if (existing.some((r) => r.name === name)) {
      throw new ConflictError(`relation type already declared: ${name}`);
    }
    const rt: RelationType = RelationTypeSchema.parse({
      id: this.deps.ids.uuid(),
      firmId: ctx.firmId,
      engagementId: ctx.engagementId,
      schemaVersionId,
      name,
      symmetric: opts.symmetric ?? false,
      description: opts.description ?? '',
      createdAt: this.deps.clock.nowIso(),
    });
    await this.deps.store.insertRelationType(ctx, rt);
    return rt;
  }

  async freezeVersion(
    ctx: EngagementContext,
    schemaVersionId: string,
  ): Promise<SchemaVersion> {
    const version = await this.deps.store.getSchemaVersion(ctx, schemaVersionId);
    if (!version) throw new NotFoundError('SchemaVersion', schemaVersionId);
    if (version.status === 'frozen') return version;
    if (version.status === 'archived') {
      throw new ConflictError('cannot freeze an archived schema version');
    }
    const frozenAt = this.deps.clock.nowIso();
    await this.deps.store.updateSchemaVersionStatus(ctx, schemaVersionId, 'frozen', frozenAt);
    const updated = await this.deps.store.getSchemaVersion(ctx, schemaVersionId);
    if (!updated) throw new NotFoundError('SchemaVersion', schemaVersionId);
    return updated;
  }

  async newDraftFrom(
    ctx: EngagementContext,
    parentVersionId: string,
    name: string,
  ): Promise<SchemaVersion> {
    const parent = await this.deps.store.getSchemaVersion(ctx, parentVersionId);
    if (!parent) throw new NotFoundError('SchemaVersion', parentVersionId);
    if (parent.status !== 'frozen') {
      throw new ConflictError('parent schema version must be frozen to fork a new draft');
    }
    const draft: SchemaVersion = SchemaVersionSchema.parse({
      id: this.deps.ids.uuid(),
      firmId: ctx.firmId,
      engagementId: ctx.engagementId,
      name,
      status: 'draft',
      parentVersionId: parent.id,
      entityTypeNames: [...parent.entityTypeNames],
      relationTypeNames: [...parent.relationTypeNames],
      frozenAt: null,
      createdAt: this.deps.clock.nowIso(),
    });
    await this.deps.store.createSchemaVersion(ctx, draft);
    const parentEts = await this.deps.store.listEntityTypesForVersion(ctx, parent.id);
    for (const et of parentEts) {
      await this.deps.store.insertEntityType(ctx, {
        ...et,
        id: this.deps.ids.uuid(),
        schemaVersionId: draft.id,
        createdAt: draft.createdAt,
      });
    }
    const parentRts = await this.deps.store.listRelationTypesForVersion(ctx, parent.id);
    for (const rt of parentRts) {
      await this.deps.store.insertRelationType(ctx, {
        ...rt,
        id: this.deps.ids.uuid(),
        schemaVersionId: draft.id,
        createdAt: draft.createdAt,
      });
    }
    return draft;
  }

  async getActive(ctx: EngagementContext): Promise<SchemaVersion> {
    const v = await this.deps.store.getActiveSchemaVersion(ctx);
    if (!v) {
      throw new NotFoundError('SchemaVersion', `engagement ${ctx.engagementId}`);
    }
    return v;
  }

  async listEntityTypes(
    ctx: EngagementContext,
    schemaVersionId: string,
  ): Promise<EntityType[]> {
    return this.deps.store.listEntityTypesForVersion(ctx, schemaVersionId);
  }

  async listRelationTypes(
    ctx: EngagementContext,
    schemaVersionId: string,
  ): Promise<RelationType[]> {
    return this.deps.store.listRelationTypesForVersion(ctx, schemaVersionId);
  }

  async validateClaimAgainst(
    ctx: EngagementContext,
    schemaVersionId: string,
    claim: { entityType: string; predicate: string },
  ): Promise<void> {
    const version = await this.deps.store.getSchemaVersion(ctx, schemaVersionId);
    if (!version) throw new NotFoundError('SchemaVersion', schemaVersionId);
    if (!version.entityTypeNames.includes(claim.entityType)) {
      throw new ValidationError(
        `entity type ${claim.entityType} not declared in schema version ${version.name}`,
        { allowed: version.entityTypeNames },
      );
    }
    if (!version.relationTypeNames.includes(claim.predicate)) {
      throw new ValidationError(
        `relation type ${claim.predicate} not declared in schema version ${version.name}`,
        { allowed: version.relationTypeNames },
      );
    }
  }
}
