// SPDX-License-Identifier: BUSL-1.1
//
// Drizzle/postgres-js backed repository for cross_engagement_patterns. Falls
// back to an in-process map when the injected SQL is the unit-test stub
// (mirrors LibraryRepository's pattern). All reads/writes go through the
// per-firm RLS context applied by `withTenant`.

import { Inject, Injectable } from '@nestjs/common';
import type postgres from 'postgres';
import {
  type CrossEngagementPattern,
  type PatternQuery,
  type PatternRepository,
  InMemoryPatternRepository,
} from '@auditforge/cross-engagement-memory';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { BaseRepository } from '../../db/base.repository.js';
import { PG_CLIENT } from '../../db/db.module.js';

interface DbRow {
  id: string;
  firm_id: string;
  pattern_kind: string;
  dimensions: Record<string, string | number | boolean> | null;
  sample_size: number;
  observation: string;
  confidence: number;
  last_updated: string;
}

@Injectable()
export class CrossEngagementMemoryRepository extends BaseRepository implements PatternRepository {
  private readonly fallback = new InMemoryPatternRepository();

  constructor(@Inject(PG_CLIENT) sql: postgres.Sql, tenancy: TenancyAdapter) {
    super(sql, tenancy);
  }

  private hasRealDb(): boolean {
    return typeof (this.sql as unknown as { begin?: unknown }).begin === 'function';
  }

  async upsert(p: CrossEngagementPattern): Promise<void> {
    if (!this.hasRealDb()) {
      await this.fallback.upsert(p);
      return;
    }
    await this.withTenant(async (tx) => {
      await tx`
        INSERT INTO cross_engagement_patterns
          (id, firm_id, pattern_kind, dimensions, sample_size, observation, confidence, last_updated)
        VALUES
          (${p.id}, ${p.firmId}::uuid, ${p.patternKind}, ${tx.json(p.dimensions)},
           ${p.sampleSize}, ${p.observation}, ${p.confidence}, ${p.lastUpdated})
        ON CONFLICT (id) DO UPDATE SET
          dimensions = EXCLUDED.dimensions,
          sample_size = EXCLUDED.sample_size,
          observation = EXCLUDED.observation,
          confidence = EXCLUDED.confidence,
          last_updated = EXCLUDED.last_updated
      `;
    });
  }

  async query(q: PatternQuery): Promise<readonly CrossEngagementPattern[]> {
    if (!this.hasRealDb()) return this.fallback.query(q);
    return this.withTenant(async (tx) => {
      const limit = q.limit ?? 50;
      const rows = q.patternKind
        ? ((await tx`
            SELECT id, firm_id, pattern_kind, dimensions, sample_size,
                   observation, confidence, last_updated
            FROM cross_engagement_patterns
            WHERE pattern_kind = ${q.patternKind}
            ORDER BY last_updated DESC
            LIMIT ${limit}
          `) as unknown as DbRow[])
        : ((await tx`
            SELECT id, firm_id, pattern_kind, dimensions, sample_size,
                   observation, confidence, last_updated
            FROM cross_engagement_patterns
            ORDER BY last_updated DESC
            LIMIT ${limit}
          `) as unknown as DbRow[]);
      const out = rows.map(toDomain);
      if (q.scope) {
        return out.filter((r) => matchesScope(r.dimensions, q.scope as Record<string, string>));
      }
      return out;
    });
  }

  async exportFirm(firmId: string): Promise<readonly CrossEngagementPattern[]> {
    if (!this.hasRealDb()) return this.fallback.exportFirm(firmId);
    return this.withTenant(async (tx) => {
      const rows = (await tx`
        SELECT id, firm_id, pattern_kind, dimensions, sample_size,
               observation, confidence, last_updated
        FROM cross_engagement_patterns
        ORDER BY last_updated DESC
      `) as unknown as DbRow[];
      return rows.map(toDomain);
    });
  }
}

function toDomain(r: DbRow): CrossEngagementPattern {
  return {
    id: r.id,
    firmId: r.firm_id,
    patternKind: r.pattern_kind as CrossEngagementPattern['patternKind'],
    dimensions: (r.dimensions ?? {}) as CrossEngagementPattern['dimensions'],
    sampleSize: r.sample_size,
    observation: r.observation,
    confidence: r.confidence,
    lastUpdated: r.last_updated,
  };
}

function matchesScope(
  dimensions: Record<string, unknown>,
  scope: Record<string, string>,
): boolean {
  for (const [k, v] of Object.entries(scope)) {
    if (dimensions[k] !== v) return false;
  }
  return true;
}
