// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import type { CreateCapaDto, UpdateCapaDto, CapaDto } from './dto.js';
import { CapaRepository } from './capa.repository.js';

@Injectable()
export class CapaService {
  constructor(private readonly repo: CapaRepository) {}

  create(firmId: string, dto: CreateCapaDto): Promise<CapaDto> { return this.repo.create(firmId, dto); }
  get(firmId: string, id: string): Promise<CapaDto> { return this.repo.findById(firmId, id); }
  list(firmId: string, opts: { cursor?: string; limit: number }): Promise<{ items: CapaDto[]; nextCursor: string | null }> { return this.repo.list(firmId, opts); }
  update(firmId: string, id: string, dto: UpdateCapaDto): Promise<CapaDto> { return this.repo.update(firmId, id, dto); }
  remove(firmId: string, id: string): Promise<void> { return this.repo.remove(firmId, id); }
}
