// SPDX-License-Identifier: BUSL-1.1
import { ConflictError, NotFoundError, ValidationError } from '@auditforge/shared';
import { ClaimSchema } from '../domain/claim.js';
import type {
  Claim,
  ClaimRelation,
  ClaimRelationKind,
  NewClaim,
} from '../domain/claim.js';
import type { EngagementContext } from '../domain/tenant.js';
import type { AuditMemoryStore } from '../adapters/store.js';
import type { LedgerSink } from '../adapters/retrieval.js';
import type { Clock } from './clock.js';
import type { IdFactory } from './id.js';
import type { SchemaRegistry } from './schema-registry.js';

export interface ClaimGraphDeps {
  store: AuditMemoryStore;
  ledger: LedgerSink;
  clock: Clock;
  ids: IdFactory;
  schemaRegistry: SchemaRegistry;
}

export class ClaimGraph {
  constructor(private readonly deps: ClaimGraphDeps) {}

  async createClaim(ctx: EngagementContext, input: NewClaim): Promise<Claim> {
    if (input.firmId !== ctx.firmId || input.engagementId !== ctx.engagementId) {
      throw new ValidationError('claim does not match tenant context', { ctx });
    }
    await this.deps.schemaRegistry.validateClaimAgainst(ctx, input.schemaVersionId, {
      entityType: input.entityType,
      predicate: input.predicate,
    });
    const id = input.id ?? this.deps.ids.uuid();
    const now = this.deps.clock.nowIso();
    const claim: Claim = ClaimSchema.parse({
      ...input,
      id,
      ingestionTime: now,
      validity: input.validity ?? 'active',
      eventTimeEnd: input.eventTimeEnd ?? null,
      evidenceEpisodeIds: input.evidenceEpisodeIds ?? [],
      embedding: input.embedding ?? null,
    });
    await this.deps.store.insertClaim(ctx, claim);
    await this.deps.store.insertClaimTemporal(ctx, {
      claimId: claim.id,
      validity: 'active',
      eventTimeStart: claim.eventTimeStart,
      eventTimeEnd: claim.eventTimeEnd,
      reason: 'created',
      recordedAt: now,
    });
    await this.deps.ledger.emitClaimCreated(ctx, claim.id);
    return claim;
  }

  async invalidate(
    ctx: EngagementContext,
    claimId: string,
    reason: string,
  ): Promise<Claim> {
    const claim = await this.deps.store.getClaim(ctx, claimId);
    if (!claim) throw new NotFoundError('Claim', claimId);
    if (claim.validity !== 'active') {
      throw new ConflictError(`cannot invalidate non-active claim (validity=${claim.validity})`);
    }
    const now = this.deps.clock.nowIso();
    await this.deps.store.updateClaim(ctx, claimId, {
      validity: 'invalidated',
      eventTimeEnd: now,
    });
    await this.deps.store.insertClaimTemporal(ctx, {
      claimId,
      validity: 'invalidated',
      eventTimeStart: claim.eventTimeStart,
      eventTimeEnd: now,
      reason,
      recordedAt: now,
    });
    await this.deps.ledger.emitClaimInvalidated(ctx, claimId, reason);
    const updated = await this.deps.store.getClaim(ctx, claimId);
    if (!updated) throw new NotFoundError('Claim', claimId);
    return updated;
  }

  async supersede(
    ctx: EngagementContext,
    oldClaimId: string,
    replacementId: string,
    rationale = '',
  ): Promise<{ old: Claim; replacement: Claim; relation: ClaimRelation }> {
    if (oldClaimId === replacementId) {
      throw new ValidationError('cannot supersede a claim with itself');
    }
    const old = await this.deps.store.getClaim(ctx, oldClaimId);
    if (!old) throw new NotFoundError('Claim', oldClaimId);
    const replacement = await this.deps.store.getClaim(ctx, replacementId);
    if (!replacement) throw new NotFoundError('Claim', replacementId);
    if (old.validity !== 'active') {
      throw new ConflictError(`cannot supersede non-active claim (validity=${old.validity})`);
    }
    const now = this.deps.clock.nowIso();
    await this.deps.store.updateClaim(ctx, oldClaimId, {
      validity: 'superseded',
      eventTimeEnd: now,
    });
    await this.deps.store.insertClaimTemporal(ctx, {
      claimId: oldClaimId,
      validity: 'superseded',
      eventTimeStart: old.eventTimeStart,
      eventTimeEnd: now,
      reason: rationale || `superseded by ${replacementId}`,
      recordedAt: now,
    });
    const relation: ClaimRelation = {
      id: this.deps.ids.uuid(),
      firmId: ctx.firmId,
      engagementId: ctx.engagementId,
      claimAId: replacementId,
      relation: 'supersedes',
      claimBId: oldClaimId,
      rationale,
      createdAt: now,
    };
    await this.deps.store.insertClaimRelation(ctx, relation);
    await this.deps.ledger.emitClaimSuperseded(ctx, oldClaimId, replacementId);
    const updatedOld = await this.deps.store.getClaim(ctx, oldClaimId);
    if (!updatedOld) throw new NotFoundError('Claim', oldClaimId);
    return { old: updatedOld, replacement, relation };
  }

  async addRelation(
    ctx: EngagementContext,
    aId: string,
    relation: ClaimRelationKind,
    bId: string,
    rationale = '',
  ): Promise<ClaimRelation> {
    if (aId === bId) {
      throw new ValidationError('cannot create self-relation on claim');
    }
    const a = await this.deps.store.getClaim(ctx, aId);
    if (!a) throw new NotFoundError('Claim', aId);
    const b = await this.deps.store.getClaim(ctx, bId);
    if (!b) throw new NotFoundError('Claim', bId);
    const rel: ClaimRelation = {
      id: this.deps.ids.uuid(),
      firmId: ctx.firmId,
      engagementId: ctx.engagementId,
      claimAId: aId,
      relation,
      claimBId: bId,
      rationale,
      createdAt: this.deps.clock.nowIso(),
    };
    await this.deps.store.insertClaimRelation(ctx, rel);
    return rel;
  }

  async listClaims(ctx: EngagementContext): Promise<Claim[]> {
    return this.deps.store.listClaims(ctx);
  }

  async getClaim(ctx: EngagementContext, id: string): Promise<Claim | null> {
    return this.deps.store.getClaim(ctx, id);
  }

  async listRelations(
    ctx: EngagementContext,
    filter?: {
      claimAId?: string;
      claimBId?: string;
      relation?: ClaimRelationKind;
    },
  ): Promise<ClaimRelation[]> {
    return this.deps.store.listClaimRelations(ctx, filter);
  }

  async traverse(
    ctx: EngagementContext,
    seedClaimIds: string[],
    maxDepth: number,
  ): Promise<{ claimId: string; depth: number }[]> {
    if (maxDepth < 0) {
      throw new ValidationError('maxDepth must be >= 0');
    }
    const cap = Math.min(maxDepth, 3);
    const visited = new Map<string, number>();
    let frontier = new Set<string>();
    for (const id of seedClaimIds) {
      visited.set(id, 0);
      frontier.add(id);
    }
    for (let depth = 0; depth < cap; depth++) {
      const next = new Set<string>();
      for (const id of frontier) {
        const relations = await this.deps.store.listClaimRelations(ctx);
        for (const r of relations) {
          if (r.claimAId === id && !visited.has(r.claimBId)) {
            visited.set(r.claimBId, depth + 1);
            next.add(r.claimBId);
          }
          if (r.claimBId === id && !visited.has(r.claimAId)) {
            visited.set(r.claimAId, depth + 1);
            next.add(r.claimAId);
          }
        }
      }
      frontier = next;
      if (frontier.size === 0) break;
    }
    return [...visited.entries()].map(([claimId, depth]) => ({ claimId, depth }));
  }
}
