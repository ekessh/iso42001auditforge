// SPDX-License-Identifier: BUSL-1.1
import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  InterviewComposer,
  InterviewLibraryLoader,
  type InterviewLibraryEntry,
  type InterviewPlan,
  type LibraryFilter,
} from '@auditforge/interview-library';
import type {
  ComposeInterviewPlanDto,
  CreateInterviewsDto,
  InterviewsDto,
  UpdateInterviewsDto,
} from './dto.js';
import type { InterviewsRepository } from './interviews.repository.js';
import { InterviewsAdapter } from '../../adapters/interviews.adapter.js';

@Injectable()
export class InterviewsService {
  private readonly libraryLoader: InterviewLibraryLoader;
  private readonly composer: InterviewComposer;

  constructor(
    private readonly repo: InterviewsRepository,
    @Optional() @Inject(InterviewsAdapter) private readonly adapter?: InterviewsAdapter,
  ) {
    this.libraryLoader = InterviewLibraryLoader.loadBundled();
    this.composer = new InterviewComposer(this.libraryLoader);
  }

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

  listLibrary(filter: LibraryFilter): readonly InterviewLibraryEntry[] {
    return this.libraryLoader.filter(filter);
  }

  compose(input: ComposeInterviewPlanDto): InterviewPlan {
    return this.composer.compose(input);
  }
}
