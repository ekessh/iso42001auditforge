// SPDX-License-Identifier: BUSL-1.1
//
// Working-papers service — orchestrates the package-backed
// `WorkingPapersRepository` (which delegates to
// `@auditforge/working-papers`'s registry) plus ledger emission via the
// audit-engine adapter.
//
// State transitions (`submit` -> `in_review`, `finalize` -> `final`) emit
// chain-linked events on top of the per-mutation events the package itself
// raises.

import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConflictError } from '../../common/errors.js';
import { WorkingPapersAdapter } from '../../adapters/working-papers.adapter.js';
import type {
  CreateWorkingPaperDto,
  UpdateWorkingPaperDto,
  WorkingPaperDto,
} from './dto.js';
import { WorkingPapersRepository } from './working-papers.repository.js';

@Injectable()
export class WorkingPapersService {
  constructor(
    private readonly repo: WorkingPapersRepository,
    @Optional()
    @Inject(WorkingPapersAdapter)
    private readonly wp?: WorkingPapersAdapter,
  ) {}

  create(firmId: string, dto: CreateWorkingPaperDto): Promise<WorkingPaperDto> {
    return this.repo.create(firmId, dto);
  }

  get(firmId: string, id: string): Promise<WorkingPaperDto> {
    return this.repo.findById(firmId, id);
  }

  list(firmId: string, opts: { engagementId?: string; cursor?: string; limit: number }) {
    return this.repo.list(firmId, opts);
  }

  async update(
    firmId: string,
    id: string,
    dto: UpdateWorkingPaperDto,
  ): Promise<WorkingPaperDto> {
    const cur = await this.repo.findById(firmId, id);
    if (cur.status === 'final') throw new ConflictError('Working paper is final');
    return this.repo.update(firmId, id, dto);
  }

  async submitForReview(firmId: string, id: string): Promise<WorkingPaperDto> {
    const updated = await this.repo.setStatus(firmId, id, 'in_review');
    if (this.wp) {
      await this.wp.emitWp(firmId, undefined, updated.engagementId, 'wp.submitted', id, {
        status: 'in_review',
      });
    }
    return updated;
  }

  async finalize(firmId: string, id: string): Promise<WorkingPaperDto> {
    const updated = await this.repo.setStatus(firmId, id, 'final');
    if (this.wp) {
      await this.wp.emitWp(firmId, undefined, updated.engagementId, 'wp.finalized', id, {
        status: 'final',
      });
    }
    return updated;
  }
}
