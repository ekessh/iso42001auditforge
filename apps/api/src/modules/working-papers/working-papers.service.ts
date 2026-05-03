// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import { ConflictError } from '../../common/errors.js';
import type { CreateWorkingPaperDto, UpdateWorkingPaperDto, WorkingPaperDto } from './dto.js';
import { WorkingPapersRepository } from './working-papers.repository.js';

@Injectable()
export class WorkingPapersService {
  constructor(private readonly repo: WorkingPapersRepository) {}

  create(firmId: string, dto: CreateWorkingPaperDto): Promise<WorkingPaperDto> { return this.repo.create(firmId, dto); }
  get(firmId: string, id: string): Promise<WorkingPaperDto> { return this.repo.findById(firmId, id); }
  list(firmId: string, opts: { engagementId?: string; cursor?: string; limit: number }) { return this.repo.list(firmId, opts); }

  async update(firmId: string, id: string, dto: UpdateWorkingPaperDto): Promise<WorkingPaperDto> {
    const cur = await this.repo.findById(firmId, id);
    if (cur.status === 'final') throw new ConflictError('Working paper is final');
    return this.repo.update(firmId, id, dto);
  }

  async submitForReview(firmId: string, id: string): Promise<WorkingPaperDto> {
    return this.repo.setStatus(firmId, id, 'in_review');
  }

  async finalize(firmId: string, id: string): Promise<WorkingPaperDto> {
    return this.repo.setStatus(firmId, id, 'final');
  }
}
