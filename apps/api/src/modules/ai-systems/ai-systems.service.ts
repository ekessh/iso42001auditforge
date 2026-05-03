// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import type { CreateAiSystemsDto, UpdateAiSystemsDto, AiSystemsDto } from './dto.js';
import { AiSystemsRepository } from './ai-systems.repository.js';

@Injectable()
export class AiSystemsService {
  constructor(private readonly repo: AiSystemsRepository) {}

  create(firmId: string, dto: CreateAiSystemsDto): Promise<AiSystemsDto> { return this.repo.create(firmId, dto); }
  get(firmId: string, id: string): Promise<AiSystemsDto> { return this.repo.findById(firmId, id); }
  list(firmId: string, opts: { cursor?: string; limit: number }): Promise<{ items: AiSystemsDto[]; nextCursor: string | null }> { return this.repo.list(firmId, opts); }
  update(firmId: string, id: string, dto: UpdateAiSystemsDto): Promise<AiSystemsDto> { return this.repo.update(firmId, id, dto); }
  remove(firmId: string, id: string): Promise<void> { return this.repo.remove(firmId, id); }
}
