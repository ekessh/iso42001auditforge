// SPDX-License-Identifier: BUSL-1.1
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { CreateSamplesDto, UpdateSamplesDto, SamplesDto } from './dto.js';
import { SamplesRepository } from './samples.repository.js';
import { SamplingAdapter } from '../../adapters/sampling.adapter.js';

@Injectable()
export class SamplesService {
  constructor(
    private readonly repo: SamplesRepository,
    @Optional() @Inject(SamplingAdapter) private readonly adapter?: SamplingAdapter,
  ) {}

  create(firmId: string, dto: CreateSamplesDto): Promise<SamplesDto> {
    return this.repo.create(firmId, dto);
  }
  get(firmId: string, id: string): Promise<SamplesDto> {
    return this.repo.findById(firmId, id);
  }
  list(
    firmId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{ items: SamplesDto[]; nextCursor: string | null }> {
    return this.repo.list(firmId, opts);
  }
  update(firmId: string, id: string, dto: UpdateSamplesDto): Promise<SamplesDto> {
    return this.repo.update(firmId, id, dto);
  }
  remove(firmId: string, id: string): Promise<void> {
    return this.repo.remove(firmId, id);
  }

  /** Pass-through to sampling calculators. */
  sampling(): SamplingAdapter | null {
    return this.adapter ?? null;
  }
}
