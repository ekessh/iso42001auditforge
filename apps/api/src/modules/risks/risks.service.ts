// SPDX-License-Identifier: BUSL-1.1
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { CreateRisksDto, UpdateRisksDto, RisksDto } from './dto.js';
import type { RisksRepository } from './risks.repository.js';
import { RisksAdapter } from '../../adapters/risks.adapter.js';

@Injectable()
export class RisksService {
  constructor(
    private readonly repo: RisksRepository,
    @Optional() @Inject(RisksAdapter) private readonly adapter?: RisksAdapter,
  ) {}

  create(firmId: string, dto: CreateRisksDto): Promise<RisksDto> {
    return this.repo.create(firmId, dto);
  }
  get(firmId: string, id: string): Promise<RisksDto> {
    return this.repo.findById(firmId, id);
  }
  list(
    firmId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{ items: RisksDto[]; nextCursor: string | null }> {
    return this.repo.list(firmId, opts);
  }
  update(firmId: string, id: string, dto: UpdateRisksDto): Promise<RisksDto> {
    return this.repo.update(firmId, id, dto);
  }
  remove(firmId: string, id: string): Promise<void> {
    return this.repo.remove(firmId, id);
  }

  /** Pass-through to importers / cross-checks / impact-assessment helpers. */
  helpers(): RisksAdapter | null {
    return this.adapter ?? null;
  }
}
