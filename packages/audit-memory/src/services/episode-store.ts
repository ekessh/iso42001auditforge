// SPDX-License-Identifier: BUSL-1.1
import { TenantViolation, ImmutableViolation, ValidationError } from '@auditforge/shared';
import { EpisodeSchema, NewEpisodeSchema } from '../domain/episode.js';
import type { Episode, NewEpisode } from '../domain/episode.js';
import type { EngagementContext } from '../domain/tenant.js';
import type { AuditMemoryStore } from '../adapters/store.js';
import type { LedgerSink } from '../adapters/retrieval.js';
import type { Clock } from './clock.js';
import type { IdFactory } from './id.js';

export interface EpisodeStoreDeps {
  store: AuditMemoryStore;
  ledger: LedgerSink;
  clock: Clock;
  ids: IdFactory;
}

export class EpisodeStore {
  constructor(private readonly deps: EpisodeStoreDeps) {}

  async append(ctx: EngagementContext, input: NewEpisode): Promise<Episode> {
    const parsed = NewEpisodeSchema.parse(input);
    if (parsed.firmId !== ctx.firmId || parsed.engagementId !== ctx.engagementId) {
      throw new TenantViolation('episode does not match tenant context', {
        ctx,
        episodeFirmId: parsed.firmId,
        episodeEngagementId: parsed.engagementId,
      });
    }
    const id = parsed.id ?? this.deps.ids.uuid();
    const ingestionTime = this.deps.clock.nowIso();
    const episode: Episode = EpisodeSchema.parse({
      ...parsed,
      id,
      ingestionTime,
      attachments: parsed.attachments ?? [],
      archivedAt: null,
    });
    await this.deps.store.insertEpisode(ctx, episode);
    await this.deps.ledger.emitEpisodeAppended(ctx, episode.id);
    return episode;
  }

  async get(ctx: EngagementContext, episodeId: string): Promise<Episode | null> {
    return this.deps.store.getEpisode(ctx, episodeId);
  }

  async listForEngagement(ctx: EngagementContext): Promise<Episode[]> {
    return this.deps.store.listEpisodesByEngagement(ctx);
  }

  async update(_ctx: EngagementContext, _episodeId: string): Promise<never> {
    throw new ImmutableViolation('episodes are append-only and cannot be mutated');
  }

  validateOrThrow(input: unknown): NewEpisode {
    const result = NewEpisodeSchema.safeParse(input);
    if (!result.success) {
      throw new ValidationError('invalid episode payload', {
        issues: result.error.issues,
      });
    }
    return result.data;
  }
}
