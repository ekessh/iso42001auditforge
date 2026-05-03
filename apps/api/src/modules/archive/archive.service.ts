// SPDX-License-Identifier: BUSL-1.1
//
// ArchiveService — façade over `ArchiveRepository` + `ArchiveAdapter`.
// CRUD endpoints route through the registry; freeze / verify / retention /
// LTV operations route through the adapter (package services).

import { Inject, Injectable, Optional } from '@nestjs/common';
import type { CreateArchiveDto, UpdateArchiveDto, ArchiveDto } from './dto.js';
import { ArchiveRepository } from './archive.repository.js';
import { ArchiveAdapter } from '../../adapters/archive.adapter.js';

@Injectable()
export class ArchiveService {
  constructor(
    private readonly repo: ArchiveRepository,
    @Optional() @Inject(ArchiveAdapter) private readonly adapter?: ArchiveAdapter,
  ) {}

  create(firmId: string, dto: CreateArchiveDto): Promise<ArchiveDto> {
    return this.repo.create(firmId, dto);
  }
  get(firmId: string, id: string): Promise<ArchiveDto> {
    return this.repo.findById(firmId, id);
  }
  list(
    firmId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{ items: ArchiveDto[]; nextCursor: string | null }> {
    return this.repo.list(firmId, opts);
  }
  update(firmId: string, id: string, dto: UpdateArchiveDto): Promise<ArchiveDto> {
    return this.repo.update(firmId, id, dto);
  }
  remove(firmId: string, id: string): Promise<void> {
    return this.repo.remove(firmId, id);
  }

  /** Pass-through to the archive adapter for freeze / retention / LTV. */
  archive(): ArchiveAdapter | null {
    return this.adapter ?? null;
  }
}
