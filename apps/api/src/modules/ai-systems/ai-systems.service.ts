// SPDX-License-Identifier: BUSL-1.1
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { CreateAiSystemsDto, UpdateAiSystemsDto, AiSystemsDto } from './dto.js';
import type { AiSystemsRepository } from './ai-systems.repository.js';
import { AiSystemsAdapter } from '../../adapters/ai-systems.adapter.js';

@Injectable()
export class AiSystemsService {
  constructor(
    private readonly repo: AiSystemsRepository,
    @Optional() @Inject(AiSystemsAdapter) private readonly adapter?: AiSystemsAdapter,
  ) {}

  create(firmId: string, dto: CreateAiSystemsDto): Promise<AiSystemsDto> {
    return this.repo.create(firmId, dto);
  }
  get(firmId: string, id: string): Promise<AiSystemsDto> {
    return this.repo.findById(firmId, id);
  }
  list(
    firmId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{ items: AiSystemsDto[]; nextCursor: string | null }> {
    return this.repo.list(firmId, opts);
  }
  update(firmId: string, id: string, dto: UpdateAiSystemsDto): Promise<AiSystemsDto> {
    return this.repo.update(firmId, id, dto);
  }
  remove(firmId: string, id: string): Promise<void> {
    return this.repo.remove(firmId, id);
  }

  /** Pass-through to AiSystemRegistry / Profiler / RiskClassifier. */
  profiler(): AiSystemsAdapter | null {
    return this.adapter ?? null;
  }
}
