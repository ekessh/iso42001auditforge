// SPDX-License-Identifier: BUSL-1.1
import { ZodError } from 'zod';
import { ClaimSchema } from '../domain/claim.js';
import type { Claim } from '../domain/claim.js';
import type { Episode } from '../domain/episode.js';
import type { EngagementContext } from '../domain/tenant.js';
import type {
  ExtractionInvocation,
  ExtractionRejection,
} from '../domain/invocation.js';
import type { AuditMemoryStore } from '../adapters/store.js';
import type { ExtractionAdapter } from '../adapters/extraction.js';
import type { Clock } from './clock.js';
import type { IdFactory } from './id.js';
import type { ClaimGraph } from './claim-graph.js';
import type { SchemaRegistry } from './schema-registry.js';

export interface CompactionWorkerDeps {
  store: AuditMemoryStore;
  extractor: ExtractionAdapter;
  clock: Clock;
  ids: IdFactory;
  claimGraph: ClaimGraph;
  schemaRegistry: SchemaRegistry;
  archiveAfterDays: number;
}

export interface CompactionResult {
  episodeId: string;
  acceptedClaimIds: string[];
  rejected: ExtractionRejection[];
  invocationId: string;
}

export class CompactionWorker {
  constructor(private readonly deps: CompactionWorkerDeps) {}

  async compactEpisode(
    ctx: EngagementContext,
    episode: Episode,
  ): Promise<CompactionResult> {
    const schema = await this.deps.schemaRegistry.getActive(ctx);
    const result = await this.deps.extractor.extract(episode, schema);
    const acceptedIds: string[] = [];
    const rejections: ExtractionRejection[] = [...result.rejections];
    for (const candidate of result.claims) {
      try {
        if (
          candidate.firmId !== ctx.firmId ||
          candidate.engagementId !== ctx.engagementId
        ) {
          rejections.push({
            reason: 'tenant_mismatch',
            raw: candidate,
          });
          continue;
        }
        if (candidate.schemaVersionId !== schema.id) {
          rejections.push({
            reason: 'schema_version_mismatch',
            raw: candidate,
          });
          continue;
        }
        if (!schema.entityTypeNames.includes(candidate.entityType)) {
          rejections.push({
            reason: `unknown_entity_type:${candidate.entityType}`,
            raw: candidate,
          });
          continue;
        }
        if (!schema.relationTypeNames.includes(candidate.predicate)) {
          rejections.push({
            reason: `unknown_relation_type:${candidate.predicate}`,
            raw: candidate,
          });
          continue;
        }
        ClaimSchema.parse(candidate);
        const stored: Claim = await this.deps.claimGraph.createClaim(ctx, {
          ...candidate,
          evidenceEpisodeIds: candidate.evidenceEpisodeIds.includes(episode.id)
            ? candidate.evidenceEpisodeIds
            : [...candidate.evidenceEpisodeIds, episode.id],
        });
        acceptedIds.push(stored.id);
      } catch (e) {
        const reason = e instanceof ZodError
          ? `zod:${e.issues.map((i) => i.message).join('|')}`
          : `error:${e instanceof Error ? e.message : String(e)}`;
        rejections.push({ reason, raw: candidate });
      }
    }
    const invocation: ExtractionInvocation = {
      id: this.deps.ids.uuid(),
      firmId: ctx.firmId,
      engagementId: ctx.engagementId,
      sourceEpisodeId: episode.id,
      modelInvocationId: result.modelInvocationId,
      schemaVersionId: schema.id,
      rawOutput: JSON.stringify(result.claims),
      parsedClaimIds: acceptedIds,
      rejectedReasons: rejections,
      createdAt: this.deps.clock.nowIso(),
    };
    await this.deps.store.insertExtractionInvocation(ctx, invocation);
    return {
      episodeId: episode.id,
      acceptedClaimIds: acceptedIds,
      rejected: rejections,
      invocationId: invocation.id,
    };
  }

  async archiveOldSources(ctx: EngagementContext): Promise<string[]> {
    const cutoff = new Date(this.deps.clock.now());
    cutoff.setUTCDate(cutoff.getUTCDate() - this.deps.archiveAfterDays);
    const cutoffIso = cutoff.toISOString();
    const candidates = await this.deps.store.listEpisodesOlderThan(ctx, cutoffIso);
    const archivedIds: string[] = [];
    for (const ep of candidates) {
      if (ep.archivedAt) continue;
      await this.deps.store.archiveEpisodeBody(ctx, ep.id, this.deps.clock.nowIso());
      archivedIds.push(ep.id);
    }
    return archivedIds;
  }
}
