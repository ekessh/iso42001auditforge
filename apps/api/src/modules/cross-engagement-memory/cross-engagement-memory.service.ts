// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import {
  CrossEngagementAggregator,
  CrossEngagementMemoryQuery,
  type AggregatorAuditSink,
  type CrossEngagementPattern,
} from '@auditforge/cross-engagement-memory';
import type { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';
import type { CrossEngagementMemoryRepository } from './cross-engagement-memory.repository.js';
import type {
  AggregateRequestDto,
  AggregateResultDto,
  PatternDto,
  PatternKindDto,
} from './dto.js';

interface ListInput {
  readonly firmId: string;
  readonly auditorId: string;
  readonly kind?: PatternKindDto;
  readonly scope?: Record<string, string>;
  readonly limit: number;
}

@Injectable()
export class CrossEngagementMemoryService {
  private readonly q: CrossEngagementMemoryQuery;

  constructor(
    private readonly repo: CrossEngagementMemoryRepository,
    private readonly ledger: AuditEngineAdapter,
  ) {
    this.q = new CrossEngagementMemoryQuery(repo);
  }

  async list(input: ListInput): Promise<{ items: PatternDto[] }> {
    const rows = await this.q.query({
      firmId: input.firmId,
      ...(input.kind ? { patternKind: input.kind } : {}),
      ...(input.scope ? { scope: input.scope } : {}),
      limit: input.limit,
    });
    await this.ledger.append({
      firmId: input.firmId,
      actorId: input.auditorId,
      type: 'cross-engagement-memory.queried',
      entity: 'cross_engagement_pattern',
      entityId: 'list',
      payload: {
        kind: input.kind ?? null,
        scope: input.scope ?? null,
        rowCount: rows.length,
      },
    });
    return { items: rows.map(toDto) };
  }

  async aggregate(input: {
    readonly firmId: string;
    readonly auditorId: string;
    readonly request: AggregateRequestDto;
  }): Promise<AggregateResultDto> {
    const sink: AggregatorAuditSink = {
      onAggregated: async (s) => {
        await this.ledger.append({
          firmId: input.firmId,
          engagementId: s.engagementId,
          actorId: input.auditorId,
          type: 'cross-engagement-memory.aggregated',
          entity: 'cross_engagement_pattern',
          entityId: s.engagementId,
          payload: { patternsTouched: s.patternsTouched },
        });
      },
    };
    const agg = new CrossEngagementAggregator(this.repo, { auditSink: sink });
    const result = await agg.aggregate({
      engagementId: input.request.engagementId,
      firmId: input.firmId,
      scopeDimensions: input.request.scopeDimensions,
      clauseObservations: input.request.clauseObservations,
      probeOutcomes: input.request.probeOutcomes,
    });
    return {
      patternsTouched: result.patternsTouched,
      patternsSkipped: result.patternsSkipped,
      skippedReasons: [...result.skippedReasons],
    };
  }
}

function toDto(p: CrossEngagementPattern): PatternDto {
  return {
    id: p.id,
    firmId: p.firmId,
    patternKind: p.patternKind,
    dimensions: p.dimensions,
    sampleSize: p.sampleSize,
    observation: p.observation,
    confidence: p.confidence,
    lastUpdated: p.lastUpdated,
  };
}
