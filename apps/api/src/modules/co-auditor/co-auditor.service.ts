// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import type { CreateCoAuditorDto, UpdateCoAuditorDto, CoAuditorDto } from './dto.js';
import { CoAuditorRepository } from './co-auditor.repository.js';

@Injectable()
export class CoAuditorService {
  constructor(private readonly repo: CoAuditorRepository) {}

  create(firmId: string, dto: CreateCoAuditorDto): Promise<CoAuditorDto> { return this.repo.create(firmId, dto); }
  get(firmId: string, id: string): Promise<CoAuditorDto> { return this.repo.findById(firmId, id); }
  list(firmId: string, opts: { cursor?: string; limit: number }): Promise<{ items: CoAuditorDto[]; nextCursor: string | null }> { return this.repo.list(firmId, opts); }
  update(firmId: string, id: string, dto: UpdateCoAuditorDto): Promise<CoAuditorDto> { return this.repo.update(firmId, id, dto); }
  remove(firmId: string, id: string): Promise<void> { return this.repo.remove(firmId, id); }
}
