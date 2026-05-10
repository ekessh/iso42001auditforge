// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../db/base.repository.js';
import type { CrossFrameworkDto, CreateCrossFrameworkDto, UpdateCrossFrameworkDto } from './dto.js';
import type { CrossFrameworkAdapter } from '../../adapters/cross-framework.adapter.js';

@Injectable()
export class CrossFrameworkRepository extends BaseRepository {
  private adapter: CrossFrameworkAdapter | null;

  constructor(...args: unknown[]) {
    super(args[0] as never, args[1] as never);
    this.adapter = (args[2] as CrossFrameworkAdapter | undefined) ?? null;
  }

  private async ensureAdapter(): Promise<CrossFrameworkAdapter> {
    if (this.adapter) return this.adapter;
    const { AuditEngineAdapter } = await import('../../adapters/audit-engine.adapter.js');
    const { CrossFrameworkAdapter } = await import('../../adapters/cross-framework.adapter.js');
    this.adapter = new CrossFrameworkAdapter(new AuditEngineAdapter());
    return this.adapter;
  }

  async create(firmId: string, dto: CreateCrossFrameworkDto): Promise<CrossFrameworkDto> {
    return (await this.ensureAdapter()).registry.create(firmId, dto);
  }
  async findById(firmId: string, id: string): Promise<CrossFrameworkDto> {
    return (await this.ensureAdapter()).registry.findById(firmId, id);
  }
  async list(
    firmId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{ items: CrossFrameworkDto[]; nextCursor: string | null }> {
    return (await this.ensureAdapter()).registry.list(firmId, opts);
  }
  async update(firmId: string, id: string, dto: UpdateCrossFrameworkDto): Promise<CrossFrameworkDto> {
    return (await this.ensureAdapter()).registry.update(firmId, id, dto);
  }
  async remove(firmId: string, id: string): Promise<void> {
    return (await this.ensureAdapter()).registry.remove(firmId, id);
  }
}
