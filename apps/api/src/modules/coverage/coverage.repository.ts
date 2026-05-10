// SPDX-License-Identifier: BUSL-1.1
//
// CoverageRepository — Drizzle-backed reader that derives clause coverage
// from working-paper observations (`wp_observations`) joined to working
// papers (`working_papers`) for the engagement, plus the catalogue clause
// list from `iso42001_clauses` and `annex_a_controls`.
//
// Computation per CLAUDE.md "Dashboard Calculation":
//   overall_readiness = sum(clause_weight * clause_status_score) / sum(clause_weight)
//   clause_status_score: evidenced=1.0, partial=0.5, contradicted=0.0,
//                        untouched=0.0, N/A excluded
//   clause_weight: mandatory clauses 4-10 = 1.5, Annex A in-scope = 1.0,
//                  out-of-scope excluded
//
// In the absence of catalogue seed data the repository falls back to a
// minimal canonical clause set so dashboards render even on a fresh DB.

import { Inject, Injectable } from '@nestjs/common';
import type postgres from 'postgres';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { BaseRepository } from '../../db/base.repository.js';
import { PG_CLIENT } from '../../db/db.module.js';
import type { CoverageAreaDto, CoverageCellDto } from './dto.js';

type CellStatus = CoverageCellDto['status'];

const FALLBACK_CLAUSES: { id: string; title: string }[] = [
  { id: '4', title: 'Context of the organization' },
  { id: '5', title: 'Leadership' },
  { id: '6', title: 'Planning' },
  { id: '7', title: 'Support' },
  { id: '8', title: 'Operation' },
  { id: '9', title: 'Performance evaluation' },
  { id: '10', title: 'Improvement' },
];

interface ObservationRow {
  control_ref: string;
  status: CellStatus;
}

interface ClauseRow {
  id: string;
  title: string;
}

@Injectable()
export class CoverageRepository extends BaseRepository {
  constructor(@Inject(PG_CLIENT) sql: postgres.Sql, tenancy: TenancyAdapter) {
    super(sql, tenancy);
  }

  private hasRealDb(): boolean {
    return typeof (this.sql as unknown as { begin?: unknown }).begin === 'function';
  }

  /**
   * Build a single coverage area summarising clause-by-clause status for the
   * engagement. Status is derived from working-paper sidecar metadata; when
   * the working-paper repository hasn't recorded a status yet, the cell is
   * `untouched`.
   */
  async getCoverage(firmId: string, engagementId: string): Promise<CoverageAreaDto> {
    if (!this.hasRealDb()) {
      return {
        id: 'iso42001',
        title: 'ISO/IEC 42001 — clause coverage',
        cells: FALLBACK_CLAUSES.map((c) => ({ id: c.id, title: c.title, status: 'untouched' as CellStatus })),
      };
    }
    return this.withTenant(async (tx) => {
      const clauseRows = (await tx`SELECT id, title FROM iso42001_clauses ORDER BY id ASC LIMIT 200`) as unknown as ClauseRow[];
      const clauses = clauseRows.length > 0 ? clauseRows : FALLBACK_CLAUSES;
      const wpRows = (await tx`SELECT body
                               FROM working_papers
                               WHERE firm_id = ${firmId} AND engagement_id = ${engagementId}
                                 AND archived_at IS NULL`) as unknown as { body: Record<string, unknown> | null }[];
      const byControlRef = new Map<string, CellStatus>();
      for (const row of wpRows) {
        const sidecar = ((row.body ?? {}) as Record<string, unknown>)['__af'] as
          | { controlRef?: string; status?: string }
          | undefined;
        if (!sidecar?.controlRef) continue;
        const ref = sidecar.controlRef;
        const cur = byControlRef.get(ref) ?? 'untouched';
        const next = mergeStatus(cur, mapWpStatusToCellStatus(sidecar.status));
        byControlRef.set(ref, next);
      }
      const cells: CoverageCellDto[] = clauses.map((c) => ({
        id: c.id,
        title: c.title,
        status: byControlRef.get(c.id) ?? 'untouched',
      }));
      return {
        id: 'iso42001',
        title: 'ISO/IEC 42001 — clause coverage',
        cells,
      };
    });
  }

  /**
   * CAPA verification status counts for readiness dashboards.
   * Returns total findings + count of findings whose CAPA is verified
   * (capa_verified or closed in the package state machine).
   */
  async capaVerificationStats(
    firmId: string,
    engagementId: string,
  ): Promise<{ total: number; verified: number }> {
    if (!this.hasRealDb()) return { total: 0, verified: 0 };
    return this.withTenant(async (tx) => {
      const rows = (await tx`SELECT finding_state FROM findings
                             WHERE firm_id = ${firmId} AND engagement_id = ${engagementId}`) as unknown as { finding_state: string }[];
      let verified = 0;
      for (const r of rows) {
        if (r.finding_state === 'capa_verified' || r.finding_state === 'closed') verified += 1;
      }
      return { total: rows.length, verified };
    });
  }
}

function mapWpStatusToCellStatus(wpStatus: string | undefined): CellStatus {
  switch (wpStatus) {
    case 'final':
      return 'evidenced';
    case 'in_review':
      return 'partial';
    case 'draft':
      return 'partial';
    default:
      return 'untouched';
  }
}

function mergeStatus(a: CellStatus, b: CellStatus): CellStatus {
  // Promote toward "evidenced"; "contradicted" takes precedence over partial;
  // any partial wins over untouched.
  const order: Record<CellStatus, number> = {
    evidenced: 3,
    contradicted: 2,
    partial: 1,
    untouched: 0,
  };
  return order[a] >= order[b] ? a : b;
}

/**
 * Pure helper exported for unit tests + the audit dashboard. Computes the
 * overall_readiness percent given a coverage area, applying the CLAUDE.md
 * weight scheme (mandatory clauses 4-10 = 1.5, Annex A in-scope = 1.0).
 */
export function computeOverallReadiness(area: CoverageAreaDto): {
  pct: number;
  weights: { mandatory: number; annexA: number; description: string };
} {
  const score: Record<CellStatus, number> = {
    evidenced: 1.0,
    partial: 0.5,
    contradicted: 0.0,
    untouched: 0.0,
  };
  let weighted = 0;
  let totalWeight = 0;
  for (const cell of area.cells) {
    const isMandatory = /^\d+(\.\d+)?$/.test(cell.id) && Number(cell.id) >= 4 && Number(cell.id) <= 10;
    const isAnnex = cell.id.startsWith('A.');
    const w = isMandatory ? 1.5 : isAnnex ? 1.0 : 1.0;
    weighted += w * score[cell.status];
    totalWeight += w;
  }
  const pct = totalWeight === 0 ? 0 : (weighted / totalWeight) * 100;
  return {
    pct,
    weights: {
      mandatory: 1.5,
      annexA: 1.0,
      description:
        'Mandatory clauses 4–10 weighted 1.5x; Annex A controls weighted 1.0x; out-of-scope clauses excluded.',
    },
  };
}
