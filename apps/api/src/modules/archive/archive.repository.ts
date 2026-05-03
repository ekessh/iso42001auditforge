// SPDX-License-Identifier: BUSL-1.1
//
// ArchiveRepository — delegates to `ArchiveAdapter`'s tenant-scoped
// registry. The richer freeze / integrity / retention / LTV operations are
// exposed via the adapter and consumed directly by the service layer.

import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../db/base.repository.js';
import type { ArchiveDto, CreateArchiveDto, UpdateArchiveDto } from './dto.js';
import { ArchiveAdapter } from '../../adapters/archive.adapter.js';

@Injectable()
export class ArchiveRepository extends BaseRepository {
  private adapter: ArchiveAdapter | null;

  constructor(...args: unknown[]) {
    super(args[0] as never, args[1] as never);
    this.adapter = (args[2] as ArchiveAdapter | undefined) ?? null;
  }

  private async ensureAdapter(): Promise<ArchiveAdapter> {
    if (this.adapter) return this.adapter;
    const { AuditEngineAdapter } = await import('../../adapters/audit-engine.adapter.js');
    const { ArchiveAdapter } = await import('../../adapters/archive.adapter.js');
    this.adapter = new ArchiveAdapter(new AuditEngineAdapter());
    return this.adapter;
  }

  async create(firmId: string, dto: CreateArchiveDto): Promise<ArchiveDto> {
    return (await this.ensureAdapter()).registry.create(firmId, dto);
  }
  async findById(firmId: string, id: string): Promise<ArchiveDto> {
    return (await this.ensureAdapter()).registry.findById(firmId, id);
  }
  async list(
    firmId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{ items: ArchiveDto[]; nextCursor: string | null }> {
    return (await this.ensureAdapter()).registry.list(firmId, opts);
  }
  async update(firmId: string, id: string, dto: UpdateArchiveDto): Promise<ArchiveDto> {
    return (await this.ensureAdapter()).registry.update(firmId, id, dto);
  }
  async remove(firmId: string, id: string): Promise<void> {
    return (await this.ensureAdapter()).registry.remove(firmId, id);
  }
}
