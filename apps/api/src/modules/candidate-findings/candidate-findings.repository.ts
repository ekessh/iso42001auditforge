// SPDX-License-Identifier: BUSL-1.1
//
// CandidateFindingsRepository — Drizzle-backed reader for the
// `candidate_findings` table. The Conversational Audit Engine writes the
// rows (Agent F's domain); this repository owns only the read path used by
// the auditor workspace, plus the dismiss-with-rationale mutation. The
// `promote` flow is handled by FindingsRepository.promoteCandidate so the
// finding insert + candidate stamp run in one transaction.
//
// In-memory fallback is provided so unit tests that wire the repository
// with `({} as never, tenancy)` continue to work without a live DB.

import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type postgres from 'postgres';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { BaseRepository } from '../../db/base.repository.js';
import { NotFoundError } from '../../common/errors.js';
import { PG_CLIENT } from '../../db/db.module.js';
import type {
  CandidateFindingDto,
  CandidateFindingType,
  CandidateFindingConfidence,
} from './dto.js';

interface CfRow {
  id: string;
  firm_id: string;
  engagement_id: string;
  status: string;
  rationale: string | null;
  payload: {
    type?: CandidateFindingType;
    typeLabel?: string;
    statement?: string;
    clauses?: { id: string; label: string }[];
    confidence?: CandidateFindingConfidence;
    source?: string;
    claimRefs?: string[];
    parked?: boolean;
  } | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const TYPE_LABELS: Record<CandidateFindingType, string> = {
  major: 'Major NC',
  minor: 'Minor NC',
  ofi: 'Opportunity for Improvement',
  observation: 'Observation',
};

function rowToDto(row: CfRow): CandidateFindingDto {
  const p = row.payload ?? {};
  const type: CandidateFindingType = p.type ?? 'observation';
  return {
    id: row.id,
    type,
    typeLabel: p.typeLabel ?? TYPE_LABELS[type],
    statement: p.statement ?? '',
    clauses: [...(p.clauses ?? [])],
    confidence: p.confidence ?? 'low',
    source: p.source ?? 'engine',
    claimRefs: [...(p.claimRefs ?? [])],
    parked: p.parked ?? row.status === 'parked',
  };
}

@Injectable()
export class CandidateFindingsRepository extends BaseRepository {
  private readonly memory = new Map<string, { row: CfRow; engagementId: string }>();

  constructor(@Inject(PG_CLIENT) sql: postgres.Sql, tenancy: TenancyAdapter) {
    super(sql, tenancy);
  }

  private hasRealDb(): boolean {
    return typeof (this.sql as unknown as { begin?: unknown }).begin === 'function';
  }

  async listForEngagement(
    firmId: string,
    engagementId: string,
  ): Promise<CandidateFindingDto[]> {
    if (!this.hasRealDb()) return this.listInMemory(firmId, engagementId);
    return this.withTenant(async (tx) => {
      const rows = (await tx`SELECT * FROM candidate_findings
                             WHERE firm_id = ${firmId} AND engagement_id = ${engagementId}
                               AND status NOT IN ('promoted', 'dismissed')
                             ORDER BY created_at ASC LIMIT 500`) as unknown as CfRow[];
      return rows.map(rowToDto);
    });
  }

  async findById(firmId: string, id: string): Promise<CfRow> {
    if (!this.hasRealDb()) {
      const r = this.memory.get(id);
      if (!r || r.row.firm_id !== firmId) throw new NotFoundError('CandidateFinding', id);
      return r.row;
    }
    return this.withTenant(async (tx) => {
      const rows = (await tx`SELECT * FROM candidate_findings
                             WHERE id = ${id} AND firm_id = ${firmId}`) as unknown as CfRow[];
      const row = rows[0];
      if (!row) throw new NotFoundError('CandidateFinding', id);
      return row;
    });
  }

  async dismiss(
    firmId: string,
    id: string,
    rationale: string,
  ): Promise<{ id: string; status: string }> {
    if (!this.hasRealDb()) {
      const r = this.memory.get(id);
      if (!r || r.row.firm_id !== firmId) throw new NotFoundError('CandidateFinding', id);
      r.row.status = 'dismissed';
      r.row.rationale = rationale;
      return { id, status: 'dismissed' };
    }
    return this.withTenant(async (tx) => {
      const rows = (await tx`UPDATE candidate_findings
               SET status = 'dismissed', rationale = ${rationale}, updated_at = now()
               WHERE id = ${id} AND firm_id = ${firmId}
               RETURNING id, status`) as unknown as { id: string; status: string }[];
      const row = rows[0];
      if (!row) throw new NotFoundError('CandidateFinding', id);
      return row;
    });
  }

  /** Test/dev seed. Used by integration tests + the in-memory fallback. */
  seed(
    firmId: string,
    engagementId: string,
    cf: Partial<CandidateFindingDto> & { id?: string },
  ): CandidateFindingDto {
    const id = cf.id ?? randomUUID();
    const type: CandidateFindingType = cf.type ?? 'observation';
    const dto: CandidateFindingDto = {
      id,
      type,
      typeLabel: cf.typeLabel ?? TYPE_LABELS[type],
      statement: cf.statement ?? 'Synthesized candidate from engine',
      clauses: cf.clauses ?? [],
      confidence: cf.confidence ?? 'low',
      source: cf.source ?? 'engine',
      claimRefs: cf.claimRefs ?? [],
      parked: cf.parked ?? false,
    };
    const row: CfRow = {
      id,
      firm_id: firmId,
      engagement_id: engagementId,
      status: 'pending',
      rationale: null,
      payload: dto,
      created_at: new Date(),
      updated_at: new Date(),
    };
    this.memory.set(id, { row, engagementId });
    return dto;
  }

  private async listInMemory(
    firmId: string,
    engagementId: string,
  ): Promise<CandidateFindingDto[]> {
    return [...this.memory.values()]
      .filter(
        (m) =>
          m.row.firm_id === firmId &&
          m.engagementId === engagementId &&
          m.row.status !== 'promoted' &&
          m.row.status !== 'dismissed',
      )
      .map((m) => rowToDto(m.row));
  }
}
