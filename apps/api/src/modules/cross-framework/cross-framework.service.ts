// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import type { CreateCrossFrameworkDto, UpdateCrossFrameworkDto, CrossFrameworkDto } from './dto.js';
import { CrossFrameworkRepository } from './cross-framework.repository.js';

@Injectable()
export class CrossFrameworkService {
  constructor(private readonly repo: CrossFrameworkRepository) {}

  create(firmId: string, dto: CreateCrossFrameworkDto): Promise<CrossFrameworkDto> { return this.repo.create(firmId, dto); }
  get(firmId: string, id: string): Promise<CrossFrameworkDto> { return this.repo.findById(firmId, id); }
  list(firmId: string, opts: { cursor?: string; limit: number }): Promise<{ items: CrossFrameworkDto[]; nextCursor: string | null }> { return this.repo.list(firmId, opts); }
  update(firmId: string, id: string, dto: UpdateCrossFrameworkDto): Promise<CrossFrameworkDto> { return this.repo.update(firmId, id, dto); }
  remove(firmId: string, id: string): Promise<void> { return this.repo.remove(firmId, id); }
}
