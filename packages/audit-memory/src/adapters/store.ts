// SPDX-License-Identifier: BUSL-1.1
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

export interface ClaimUpdate {
  validity?: ClaimValidity;
  eventTimeEnd?: string | null;
}

export interface ClaimTemporalRecord {
  claimId: string;
  validity: ClaimValidity;
  eventTimeStart: string;
  eventTimeEnd: string | null;
  reason: string;
  recordedAt: string;
}

export interface AuditMemoryStore {
  insertEpisode(ctx: EngagementContext, episode: Episode): Promise<void>;
  archiveEpisodeBody(ctx: EngagementContext, episodeId: string, archivedAt: string): Promise<void>;
  getEpisode(ctx: EngagementContext, episodeId: string): Promise<Episode | null>;
  listEpisodesOlderThan(ctx: EngagementContext, isoDate: string): Promise<Episode[]>;
  listEpisodesByEngagement(ctx: EngagementContext): Promise<Episode[]>;

  createSchemaVersion(ctx: EngagementContext, version: SchemaVersion): Promise<void>;
  updateSchemaVersionStatus(
    ctx: EngagementContext,
    versionId: string,
    status: SchemaVersionStatus,
    frozenAt: string | null,
  ): Promise<void>;
  getSchemaVersion(ctx: EngagementContext, versionId: string): Promise<SchemaVersion | null>;
  getActiveSchemaVersion(ctx: EngagementContext): Promise<SchemaVersion | null>;
  insertEntityType(ctx: EngagementContext, et: EntityType): Promise<void>;
  insertRelationType(ctx: EngagementContext, rt: RelationType): Promise<void>;
  listEntityTypesForVersion(
    ctx: EngagementContext,
    versionId: string,
  ): Promise<EntityType[]>;
  listRelationTypesForVersion(
    ctx: EngagementContext,
    versionId: string,
  ): Promise<RelationType[]>;

  insertClaim(ctx: EngagementContext, claim: Claim): Promise<void>;
  updateClaim(
    ctx: EngagementContext,
    claimId: string,
    update: ClaimUpdate,
  ): Promise<void>;
  getClaim(ctx: EngagementContext, claimId: string): Promise<Claim | null>;
  listClaims(ctx: EngagementContext): Promise<Claim[]>;
  insertClaimTemporal(
    ctx: EngagementContext,
    record: ClaimTemporalRecord,
  ): Promise<void>;
  listClaimTemporal(
    ctx: EngagementContext,
    claimId: string,
  ): Promise<ClaimTemporalRecord[]>;

  insertClaimRelation(ctx: EngagementContext, rel: ClaimRelation): Promise<void>;
  listClaimRelations(
    ctx: EngagementContext,
    filter?: {
      claimAId?: string;
      claimBId?: string;
      relation?: ClaimRelationKind;
    },
  ): Promise<ClaimRelation[]>;

  insertClaimAttribution(
    ctx: EngagementContext,
    attribution: ClaimAttribution,
  ): Promise<void>;
  updateClaimAttributionStatus(
    ctx: EngagementContext,
    attributionId: string,
    fromStatus: ClaimAttributionStatus,
    toStatus: ClaimAttributionStatus,
    decidedAt: string,
    decidedBy: string,
    rationale: string,
  ): Promise<void>;
  listClaimAttributions(
    ctx: EngagementContext,
    claimId: string,
  ): Promise<ClaimAttribution[]>;

  insertExtractionInvocation(
    ctx: EngagementContext,
    invocation: ExtractionInvocation,
  ): Promise<void>;
  listExtractionInvocations(ctx: EngagementContext): Promise<ExtractionInvocation[]>;

  insertRetrievalInvocation(
    ctx: EngagementContext,
    invocation: RetrievalInvocation,
  ): Promise<void>;
  listRetrievalInvocations(ctx: EngagementContext): Promise<RetrievalInvocation[]>;
}
