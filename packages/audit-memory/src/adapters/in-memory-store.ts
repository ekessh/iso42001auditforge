// SPDX-License-Identifier: BUSL-1.1
import { TenantViolation } from '@auditforge/shared';
import type { Episode } from '../domain/episode.js';
import type {
  Claim,
  ClaimRelation,
  ClaimRelationKind,
  ClaimValidity,
  ClaimAttribution,
  ClaimAttributionStatus,
} from '../domain/claim.js';
import type {
  EntityType,
  RelationType,
  SchemaVersion,
  SchemaVersionStatus,
} from '../domain/schema-version.js';
import type {
  ExtractionInvocation,
  RetrievalInvocation,
} from '../domain/invocation.js';
import type { EngagementContext } from '../domain/tenant.js';
import type {
  AuditMemoryStore,
  ClaimUpdate,
  ClaimTemporalRecord,
} from './store.js';

interface Scoped {
  firmId: string;
  engagementId: string;
}

function assertSameEngagement(ctx: EngagementContext, row: Scoped): void {
  if (row.firmId !== ctx.firmId || row.engagementId !== ctx.engagementId) {
    throw new TenantViolation('cross-engagement access denied', {
      expected: { firmId: ctx.firmId, engagementId: ctx.engagementId },
      actual: { firmId: row.firmId, engagementId: row.engagementId },
    });
  }
}

export class InMemoryAuditMemoryStore implements AuditMemoryStore {
  private readonly episodes = new Map<string, Episode>();
  private readonly schemaVersions = new Map<string, SchemaVersion>();
  private readonly entityTypes = new Map<string, EntityType>();
  private readonly relationTypes = new Map<string, RelationType>();
  private readonly claims = new Map<string, Claim>();
  private readonly claimTemporal: ClaimTemporalRecord[] = [];
  private readonly claimRelations = new Map<string, ClaimRelation>();
  private readonly claimAttributions = new Map<string, ClaimAttribution>();
  private readonly retrievalInvocations: RetrievalInvocation[] = [];
  private readonly extractionInvocations: ExtractionInvocation[] = [];

  async insertEpisode(ctx: EngagementContext, episode: Episode): Promise<void> {
    assertSameEngagement(ctx, episode);
    if (this.episodes.has(episode.id)) {
      throw new Error(`episode already exists: ${episode.id}`);
    }
    this.episodes.set(episode.id, { ...episode });
  }

  async archiveEpisodeBody(
    ctx: EngagementContext,
    episodeId: string,
    archivedAt: string,
  ): Promise<void> {
    const e = this.episodes.get(episodeId);
    if (!e) return;
    assertSameEngagement(ctx, e);
    this.episodes.set(episodeId, { ...e, body: '', archivedAt });
  }

  async getEpisode(ctx: EngagementContext, episodeId: string): Promise<Episode | null> {
    const e = this.episodes.get(episodeId);
    if (!e) return null;
    assertSameEngagement(ctx, e);
    return { ...e };
  }

  async listEpisodesOlderThan(
    ctx: EngagementContext,
    isoDate: string,
  ): Promise<Episode[]> {
    const cutoff = Date.parse(isoDate);
    return [...this.episodes.values()]
      .filter(
        (e) =>
          e.firmId === ctx.firmId &&
          e.engagementId === ctx.engagementId &&
          Date.parse(e.ingestionTime) <= cutoff &&
          !e.archivedAt,
      )
      .map((e) => ({ ...e }));
  }

  async listEpisodesByEngagement(ctx: EngagementContext): Promise<Episode[]> {
    return [...this.episodes.values()]
      .filter((e) => e.firmId === ctx.firmId && e.engagementId === ctx.engagementId)
      .map((e) => ({ ...e }));
  }

  async createSchemaVersion(
    ctx: EngagementContext,
    version: SchemaVersion,
  ): Promise<void> {
    assertSameEngagement(ctx, version);
    this.schemaVersions.set(version.id, { ...version });
  }

  async updateSchemaVersionStatus(
    ctx: EngagementContext,
    versionId: string,
    status: SchemaVersionStatus,
    frozenAt: string | null,
  ): Promise<void> {
    const v = this.schemaVersions.get(versionId);
    if (!v) throw new Error(`schema version not found: ${versionId}`);
    assertSameEngagement(ctx, v);
    this.schemaVersions.set(versionId, { ...v, status, frozenAt });
  }

  async getSchemaVersion(
    ctx: EngagementContext,
    versionId: string,
  ): Promise<SchemaVersion | null> {
    const v = this.schemaVersions.get(versionId);
    if (!v) return null;
    assertSameEngagement(ctx, v);
    return { ...v };
  }

  async getActiveSchemaVersion(ctx: EngagementContext): Promise<SchemaVersion | null> {
    const versions = [...this.schemaVersions.values()].filter(
      (v) => v.firmId === ctx.firmId && v.engagementId === ctx.engagementId,
    );
    const frozen = versions.filter((v) => v.status === 'frozen');
    if (frozen.length > 0) {
      frozen.sort((a, b) => Date.parse(b.frozenAt ?? '0') - Date.parse(a.frozenAt ?? '0'));
      return frozen[0] ? { ...frozen[0] } : null;
    }
    versions.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return versions.length > 0 && versions[0] ? { ...versions[0] } : null;
  }

  async insertEntityType(ctx: EngagementContext, et: EntityType): Promise<void> {
    assertSameEngagement(ctx, et);
    this.entityTypes.set(et.id, { ...et });
  }

  async insertRelationType(ctx: EngagementContext, rt: RelationType): Promise<void> {
    assertSameEngagement(ctx, rt);
    this.relationTypes.set(rt.id, { ...rt });
  }

  async listEntityTypesForVersion(
    ctx: EngagementContext,
    versionId: string,
  ): Promise<EntityType[]> {
    return [...this.entityTypes.values()]
      .filter(
        (et) =>
          et.firmId === ctx.firmId &&
          et.engagementId === ctx.engagementId &&
          et.schemaVersionId === versionId,
      )
      .map((et) => ({ ...et }));
  }

  async listRelationTypesForVersion(
    ctx: EngagementContext,
    versionId: string,
  ): Promise<RelationType[]> {
    return [...this.relationTypes.values()]
      .filter(
        (rt) =>
          rt.firmId === ctx.firmId &&
          rt.engagementId === ctx.engagementId &&
          rt.schemaVersionId === versionId,
      )
      .map((rt) => ({ ...rt }));
  }

  async insertClaim(ctx: EngagementContext, claim: Claim): Promise<void> {
    assertSameEngagement(ctx, claim);
    this.claims.set(claim.id, { ...claim });
  }

  async updateClaim(
    ctx: EngagementContext,
    claimId: string,
    update: ClaimUpdate,
  ): Promise<void> {
    const c = this.claims.get(claimId);
    if (!c) throw new Error(`claim not found: ${claimId}`);
    assertSameEngagement(ctx, c);
    this.claims.set(claimId, {
      ...c,
      ...(update.validity !== undefined ? { validity: update.validity } : {}),
      ...(update.eventTimeEnd !== undefined ? { eventTimeEnd: update.eventTimeEnd } : {}),
    });
  }

  async getClaim(ctx: EngagementContext, claimId: string): Promise<Claim | null> {
    const c = this.claims.get(claimId);
    if (!c) return null;
    assertSameEngagement(ctx, c);
    return { ...c };
  }

  async listClaims(ctx: EngagementContext): Promise<Claim[]> {
    return [...this.claims.values()]
      .filter((c) => c.firmId === ctx.firmId && c.engagementId === ctx.engagementId)
      .map((c) => ({ ...c }));
  }

  async insertClaimTemporal(
    ctx: EngagementContext,
    record: ClaimTemporalRecord,
  ): Promise<void> {
    const claim = this.claims.get(record.claimId);
    if (claim) assertSameEngagement(ctx, claim);
    this.claimTemporal.push({ ...record });
  }

  async listClaimTemporal(
    ctx: EngagementContext,
    claimId: string,
  ): Promise<ClaimTemporalRecord[]> {
    const claim = this.claims.get(claimId);
    if (claim) assertSameEngagement(ctx, claim);
    return this.claimTemporal.filter((t) => t.claimId === claimId).map((t) => ({ ...t }));
  }

  async insertClaimRelation(
    ctx: EngagementContext,
    rel: ClaimRelation,
  ): Promise<void> {
    assertSameEngagement(ctx, rel);
    this.claimRelations.set(rel.id, { ...rel });
  }

  async listClaimRelations(
    ctx: EngagementContext,
    filter?: {
      claimAId?: string;
      claimBId?: string;
      relation?: ClaimRelationKind;
    },
  ): Promise<ClaimRelation[]> {
    return [...this.claimRelations.values()]
      .filter((r) => r.firmId === ctx.firmId && r.engagementId === ctx.engagementId)
      .filter((r) =>
        filter?.claimAId === undefined ? true : r.claimAId === filter.claimAId,
      )
      .filter((r) =>
        filter?.claimBId === undefined ? true : r.claimBId === filter.claimBId,
      )
      .filter((r) =>
        filter?.relation === undefined ? true : r.relation === filter.relation,
      )
      .map((r) => ({ ...r }));
  }

  async insertClaimAttribution(
    ctx: EngagementContext,
    attribution: ClaimAttribution,
  ): Promise<void> {
    assertSameEngagement(ctx, attribution);
    this.claimAttributions.set(attribution.id, { ...attribution });
  }

  async updateClaimAttributionStatus(
    ctx: EngagementContext,
    attributionId: string,
    fromStatus: ClaimAttributionStatus,
    toStatus: ClaimAttributionStatus,
    decidedAt: string,
    decidedBy: string,
    _rationale: string,
  ): Promise<void> {
    const a = this.claimAttributions.get(attributionId);
    if (!a) throw new Error(`attribution not found: ${attributionId}`);
    assertSameEngagement(ctx, a);
    if (a.status !== fromStatus) {
      throw new Error(
        `attribution status mismatch: expected ${fromStatus}, got ${a.status}`,
      );
    }
    this.claimAttributions.set(attributionId, {
      ...a,
      status: toStatus,
      decidedAt,
      decidedBy,
    });
  }

  async listClaimAttributions(
    ctx: EngagementContext,
    claimId: string,
  ): Promise<ClaimAttribution[]> {
    return [...this.claimAttributions.values()]
      .filter(
        (a) =>
          a.firmId === ctx.firmId &&
          a.engagementId === ctx.engagementId &&
          a.claimId === claimId,
      )
      .map((a) => ({ ...a }));
  }

  async insertExtractionInvocation(
    ctx: EngagementContext,
    invocation: ExtractionInvocation,
  ): Promise<void> {
    assertSameEngagement(ctx, invocation);
    this.extractionInvocations.push({
      ...invocation,
      parsedClaimIds: [...invocation.parsedClaimIds],
      rejectedReasons: invocation.rejectedReasons.map((r) => ({ ...r })),
    });
  }

  async listExtractionInvocations(
    ctx: EngagementContext,
  ): Promise<ExtractionInvocation[]> {
    return this.extractionInvocations
      .filter((i) => i.firmId === ctx.firmId && i.engagementId === ctx.engagementId)
      .map((i) => ({
        ...i,
        parsedClaimIds: [...i.parsedClaimIds],
        rejectedReasons: i.rejectedReasons.map((r) => ({ ...r })),
      }));
  }

  async insertRetrievalInvocation(
    ctx: EngagementContext,
    invocation: RetrievalInvocation,
  ): Promise<void> {
    assertSameEngagement(ctx, invocation);
    this.retrievalInvocations.push({
      ...invocation,
      candidates: invocation.candidates.map((c) => ({ ...c })),
      rankedResults: invocation.rankedResults.map((c) => ({ ...c })),
    });
  }

  async listRetrievalInvocations(
    ctx: EngagementContext,
  ): Promise<RetrievalInvocation[]> {
    return this.retrievalInvocations
      .filter((i) => i.firmId === ctx.firmId && i.engagementId === ctx.engagementId)
      .map((i) => ({
        ...i,
        candidates: i.candidates.map((c) => ({ ...c })),
        rankedResults: i.rankedResults.map((c) => ({ ...c })),
      }));
  }
}
