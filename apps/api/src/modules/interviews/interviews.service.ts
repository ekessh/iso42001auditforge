// SPDX-License-Identifier: BUSL-1.1
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { CreateInterviewsDto, UpdateInterviewsDto, InterviewsDto } from './dto.js';
import { InterviewsRepository } from './interviews.repository.js';
import { InterviewsAdapter } from '../../adapters/interviews.adapter.js';

@Injectable()
export class InterviewsService {
  constructor(
    private readonly repo: InterviewsRepository,
    @Optional() @Inject(InterviewsAdapter) private readonly adapter?: InterviewsAdapter,
  ) {}

  create(firmId: string, dto: CreateInterviewsDto): Promise<InterviewsDto> {
    return this.repo.create(firmId, dto);
  }
  get(firmId: string, id: string): Promise<InterviewsDto> {
    return this.repo.findById(firmId, id);
  }
  list(
    firmId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{ items: InterviewsDto[]; nextCursor: string | null }> {
    return this.repo.list(firmId, opts);
  }
  update(firmId: string, id: string, dto: UpdateInterviewsDto): Promise<InterviewsDto> {
    return this.repo.update(firmId, id, dto);
  }
  remove(firmId: string, id: string): Promise<void> {
    return this.repo.remove(firmId, id);
  }

  /** Pass-through to interview library + scheduling helpers. */
  library(): InterviewsAdapter | null {
    return this.adapter ?? null;
  }
}
