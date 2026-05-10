// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';
import { RequestContextStore } from '../../common/request-context.js';
import { CoverageRepository, computeOverallReadiness } from './coverage.repository.js';
import type { CoverageAreaDto } from './dto.js';

@Injectable()
export class CoverageService {
  constructor(
    private readonly repo: CoverageRepository,
    private readonly ledger: AuditEngineAdapter,
  ) {}

  /**
   * Compute coverage for the engagement and emit a `coverage.computed`
   * ledger event with the full methodology + result. CLAUDE.md mandates
   * read-side ledger emission specifically for coverage computation so the
   * audit trail records every dashboard snapshot.
   */
  async compute(firmId: string, engagementId: string): Promise<CoverageAreaDto> {
    const area = await this.repo.getCoverage(firmId, engagementId);
    const ctx = RequestContextStore.get();
    const summary = computeOverallReadiness(area);
    await this.ledger.append({
      firmId,
      engagementId,
      actorId: ctx?.auditorId ?? 'system',
      ...(ctx?.roles[0] !== undefined ? { actorRole: ctx.roles[0] } : {}),
      type: 'coverage.computed',
      entity: 'coverage',
      entityId: engagementId,
      payload: {
        engagementId,
        overallReadinessPct: summary.pct,
        methodology: {
          formula:
            'overall_readiness = sum(clause_weight * clause_status_score) / sum(clause_weight)',
          scores: {
            evidenced: 1.0,
            partial: 0.5,
            contradicted: 0.0,
            untouched: 0.0,
          },
          weights: summary.weights,
        },
        cells: area.cells.length,
      },
      ...(ctx?.requestId !== undefined ? { requestId: ctx.requestId } : {}),
    });
    return area;
  }
}
