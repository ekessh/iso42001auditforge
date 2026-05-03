// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import type { CreateSoaDto, UpdateSoaDto, SoaDto } from './dto.js';
import { SoaRepository } from './soa.repository.js';

@Injectable()
export class SoaService {
  constructor(private readonly repo: SoaRepository) {}

  create(firmId: string, dto: CreateSoaDto): Promise<SoaDto> { return this.repo.create(firmId, dto); }
  get(firmId: string, id: string): Promise<SoaDto> { return this.repo.findById(firmId, id); }
  list(firmId: string, opts: { cursor?: string; limit: number }): Promise<{ items: SoaDto[]; nextCursor: string | null }> { return this.repo.list(firmId, opts); }
  update(firmId: string, id: string, dto: UpdateSoaDto): Promise<SoaDto> { return this.repo.update(firmId, id, dto); }
  remove(firmId: string, id: string): Promise<void> { return this.repo.remove(firmId, id); }
}
