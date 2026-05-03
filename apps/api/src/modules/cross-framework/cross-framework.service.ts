// SPDX-License-Identifier: BUSL-1.1
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { CreateCrossFrameworkDto, UpdateCrossFrameworkDto, CrossFrameworkDto } from './dto.js';
import { CrossFrameworkRepository } from './cross-framework.repository.js';
import { CrossFrameworkAdapter } from '../../adapters/cross-framework.adapter.js';

@Injectable()
export class CrossFrameworkService {
  constructor(
    private readonly repo: CrossFrameworkRepository,
    @Optional() @Inject(CrossFrameworkAdapter) private readonly adapter?: CrossFrameworkAdapter,
  ) {}

  create(firmId: string, dto: CreateCrossFrameworkDto): Promise<CrossFrameworkDto> {
    return this.repo.create(firmId, dto);
  }
  get(firmId: string, id: string): Promise<CrossFrameworkDto> {
    return this.repo.findById(firmId, id);
  }
  list(
    firmId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{ items: CrossFrameworkDto[]; nextCursor: string | null }> {
    return this.repo.list(firmId, opts);
  }
  update(firmId: string, id: string, dto: UpdateCrossFrameworkDto): Promise<CrossFrameworkDto> {
    return this.repo.update(firmId, id, dto);
  }
  remove(firmId: string, id: string): Promise<void> {
    return this.repo.remove(firmId, id);
  }

  /** Pass-through to the cross-framework graph + coverage calculator. */
  framework(): CrossFrameworkAdapter | null {
    return this.adapter ?? null;
  }
}
