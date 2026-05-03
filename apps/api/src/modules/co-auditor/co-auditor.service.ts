// SPDX-License-Identifier: BUSL-1.1
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { CreateCoAuditorDto, UpdateCoAuditorDto, CoAuditorDto } from './dto.js';
import { CoAuditorRepository } from './co-auditor.repository.js';
import { CoAuditorAdapter } from '../../adapters/co-auditor.adapter.js';

@Injectable()
export class CoAuditorService {
  constructor(
    private readonly repo: CoAuditorRepository,
    @Optional() @Inject(CoAuditorAdapter) private readonly adapter?: CoAuditorAdapter,
  ) {}

  create(firmId: string, dto: CreateCoAuditorDto): Promise<CoAuditorDto> {
    return this.repo.create(firmId, dto);
  }
  get(firmId: string, id: string): Promise<CoAuditorDto> {
    return this.repo.findById(firmId, id);
  }
  list(
    firmId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{ items: CoAuditorDto[]; nextCursor: string | null }> {
    return this.repo.list(firmId, opts);
  }
  update(firmId: string, id: string, dto: UpdateCoAuditorDto): Promise<CoAuditorDto> {
    return this.repo.update(firmId, id, dto);
  }
  remove(firmId: string, id: string): Promise<void> {
    return this.repo.remove(firmId, id);
  }

  /** Pass-through to the package's CoAuditorService for richer endpoints. */
  llm(): CoAuditorAdapter | null {
    return this.adapter ?? null;
  }
}
