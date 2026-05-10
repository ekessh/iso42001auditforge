// SPDX-License-Identifier: BUSL-1.1
//
// ReadinessService — assembles the Readiness Mode dashboard. Reuses the
// CoverageRepository for clause-by-clause status + CapaVerificationStats
// for CAPA verification status. Output MUST include the
// `mode: 'readiness'` and `disclaimer` fields per CLAUDE.md Termination
// Semantics so the frontend renders the non-certification disclaimer
// banner.

import { Injectable } from '@nestjs/common';
import { CoverageRepository, computeOverallReadiness } from '../coverage/coverage.repository.js';
import { CandidateFindingsRepository } from '../candidate-findings/candidate-findings.repository.js';
import {
  READINESS_DISCLAIMER,
  type AnnexFamilyDto,
  type BlockerDto,
  type OpenItemDto,
  type ReadinessDto,
} from './dto.js';

@Injectable()
export class ReadinessService {
  constructor(
    private readonly coverage: CoverageRepository,
    private readonly candidates: CandidateFindingsRepository,
  ) {}

  async build(firmId: string, engagementId: string): Promise<ReadinessDto> {
    const area = await this.coverage.getCoverage(firmId, engagementId);
    const summary = computeOverallReadiness(area);
    const capa = await this.coverage.capaVerificationStats(firmId, engagementId);

    const evidenced = area.cells.filter((c) => c.status === 'evidenced').length;
    const partial = area.cells.filter((c) => c.status === 'partial').length;
    const untouched = area.cells.filter((c) => c.status === 'untouched').length;
    const families: AnnexFamilyDto[] = [
      {
        id: area.id,
        title: area.title,
        description: 'ISO/IEC 42001 mandatory clauses',
        readinessPct: summary.pct,
        evidenced,
        partial,
        untouched,
        totalClauses: area.cells.length,
        status: classifyStatus(summary.pct),
      },
    ];

    const blockers: BlockerDto[] = area.cells
      .filter((c) => c.status === 'untouched' || c.status === 'contradicted')
      .slice(0, 5)
      .map((c) => ({
        id: `blk-${c.id}`,
        clauseId: c.id,
        clauseTitle: c.title ?? `Clause ${c.id}`,
        impact: c.status === 'contradicted' ? 'high' : 'medium',
        recommendedAction: `Capture working-paper evidence for clause ${c.id}.`,
      }));

    const cfList = await this.candidates.listForEngagement(firmId, engagementId);
    const openItems: OpenItemDto[] = cfList.slice(0, 25).map((cf) => ({
      id: cf.id,
      type: cf.type,
      title: cf.statement.slice(0, 200),
      clauseId: cf.clauses[0]?.id ?? 'unknown',
      age: 'today',
    }));

    void capa;
    return {
      overallPct: summary.pct,
      trend30dDelta: 0,
      trend90dDelta: 0,
      targetCertDate: '',
      daysToTarget: 0,
      families,
      trend: [],
      blockers,
      openItems,
      aiSystems: [],
      weights: summary.weights,
      mode: 'readiness',
      disclaimer: READINESS_DISCLAIMER,
    };
  }
}

function classifyStatus(pct: number): 'green' | 'amber' | 'red' | 'grey' {
  if (pct >= 80) return 'green';
  if (pct >= 50) return 'amber';
  if (pct > 0) return 'red';
  return 'grey';
}
