// SPDX-License-Identifier: BUSL-1.1
//
// AuditDashboardService — assembles the Audit Mode dashboard payload from
// existing repositories: coverage from CoverageRepository, candidate
// breakdown from CandidateFindingsRepository, promoted-finding count from
// FindingsRepository. Man-day burn / sampling pct are placeholders for
// now (driven by audit_plans + samples in later waves) but are returned
// with zeros so the frontend renders the dashboard skeleton end-to-end.

import { Injectable } from '@nestjs/common';
import type { CandidateFindingsRepository } from '../candidate-findings/candidate-findings.repository.js';
import type { FindingsRepository } from '../findings/findings.repository.js';
import type { CoverageRepository} from '../coverage/coverage.repository.js';
import { computeOverallReadiness } from '../coverage/coverage.repository.js';
import type { AuditDashboardDto } from './dto.js';

@Injectable()
export class AuditDashboardService {
  constructor(
    private readonly coverage: CoverageRepository,
    private readonly findings: FindingsRepository,
    private readonly candidates: CandidateFindingsRepository,
  ) {}

  async build(firmId: string, engagementId: string): Promise<AuditDashboardDto> {
    const area = await this.coverage.getCoverage(firmId, engagementId);
    const summary = computeOverallReadiness(area);
    const findingsPage = await this.findings.list(firmId, { engagementId, limit: 200 });
    const promoted = findingsPage.items.length;
    const cfList = await this.candidates.listForEngagement(firmId, engagementId);
    const breakdown = { major: 0, minor: 0, ofi: 0, observation: 0 };
    for (const cf of cfList) breakdown[cf.type] += 1;
    const covered = area.cells.filter(
      (c) => c.status === 'evidenced' || c.status === 'partial',
    ).length;
    const planned = area.cells.length;
    const risk: AuditDashboardDto['risk'] =
      planned === 0 || covered / Math.max(planned, 1) < 0.3 ? 'coverage_gap' : 'on_track';
    return {
      coveragePct: summary.pct,
      areaBars: [
        {
          areaId: area.id,
          areaTitle: area.title,
          planned,
          covered,
        },
      ],
      manDays: [],
      manDaysSpent: 0,
      manDaysPlanned: 0,
      candidateFindings: breakdown,
      promotedFindings: promoted,
      samplingCompletePct: 0,
      risk,
      attentionAreas: area.cells
        .filter((c) => c.status === 'untouched' || c.status === 'contradicted')
        .slice(0, 5)
        .map((c) => ({ areaId: c.id, reason: `Clause ${c.id} is ${c.status}` })),
    };
  }
}
