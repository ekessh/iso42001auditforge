// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import type { CreateArchiveDto, UpdateArchiveDto, ArchiveDto } from './dto.js';
import { ArchiveRepository } from './archive.repository.js';

@Injectable()
export class ArchiveService {
  constructor(private readonly repo: ArchiveRepository) {}

  create(firmId: string, dto: CreateArchiveDto): Promise<ArchiveDto> { return this.repo.create(firmId, dto); }
  get(firmId: string, id: string): Promise<ArchiveDto> { return this.repo.findById(firmId, id); }
  list(firmId: string, opts: { cursor?: string; limit: number }): Promise<{ items: ArchiveDto[]; nextCursor: string | null }> { return this.repo.list(firmId, opts); }
  update(firmId: string, id: string, dto: UpdateArchiveDto): Promise<ArchiveDto> { return this.repo.update(firmId, id, dto); }
  remove(firmId: string, id: string): Promise<void> { return this.repo.remove(firmId, id); }
}
