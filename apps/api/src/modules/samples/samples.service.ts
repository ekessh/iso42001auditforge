// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import type { CreateSamplesDto, UpdateSamplesDto, SamplesDto } from './dto.js';
import { SamplesRepository } from './samples.repository.js';

@Injectable()
export class SamplesService {
  constructor(private readonly repo: SamplesRepository) {}

  create(firmId: string, dto: CreateSamplesDto): Promise<SamplesDto> { return this.repo.create(firmId, dto); }
  get(firmId: string, id: string): Promise<SamplesDto> { return this.repo.findById(firmId, id); }
  list(firmId: string, opts: { cursor?: string; limit: number }): Promise<{ items: SamplesDto[]; nextCursor: string | null }> { return this.repo.list(firmId, opts); }
  update(firmId: string, id: string, dto: UpdateSamplesDto): Promise<SamplesDto> { return this.repo.update(firmId, id, dto); }
  remove(firmId: string, id: string): Promise<void> { return this.repo.remove(firmId, id); }
}
