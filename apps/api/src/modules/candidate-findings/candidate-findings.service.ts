// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import type { CandidateFindingsRepository } from './candidate-findings.repository.js';
import type { FindingsRepository } from '../findings/findings.repository.js';
import type {
  CandidateFindingDto,
  PromoteCandidateFindingDto,
} from './dto.js';
import type { FindingDto } from '../findings/dto.js';

@Injectable()
export class CandidateFindingsService {
  constructor(
    private readonly cfRepo: CandidateFindingsRepository,
    private readonly findingsRepo: FindingsRepository,
  ) {}

  list(firmId: string, engagementId: string): Promise<CandidateFindingDto[]> {
    return this.cfRepo.listForEngagement(firmId, engagementId);
  }

  /**
   * Promote a candidate finding to a formal finding. Auditor confirmation
   * is the only state-transition trigger (CLAUDE.md v3 Additions). The
   * candidate row is stamped `promoted` in the same transaction.
   */
  async promote(
    firmId: string,
    engagementId: string,
    cfId: string,
    dto: PromoteCandidateFindingDto,
  ): Promise<FindingDto> {
    return this.findingsRepo.promoteCandidate(firmId, cfId, {
      engagementId,
      severity: dto.severity,
      title: dto.title,
      description: dto.description,
    });
  }

  dismiss(
    firmId: string,
    cfId: string,
    rationale: string,
  ): Promise<{ id: string; status: string }> {
    return this.cfRepo.dismiss(firmId, cfId, rationale);
  }
}
