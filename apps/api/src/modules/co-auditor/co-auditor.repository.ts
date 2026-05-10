// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../db/base.repository.js';
import type { CoAuditorDto, CreateCoAuditorDto, UpdateCoAuditorDto } from './dto.js';
import type { CoAuditorAdapter } from '../../adapters/co-auditor.adapter.js';

@Injectable()
export class CoAuditorRepository extends BaseRepository {
  private adapter: CoAuditorAdapter | null;

  constructor(...args: unknown[]) {
    super(args[0] as never, args[1] as never);
    this.adapter = (args[2] as CoAuditorAdapter | undefined) ?? null;
  }

  private async ensureAdapter(): Promise<CoAuditorAdapter> {
    if (this.adapter) return this.adapter;
    const { AuditEngineAdapter } = await import('../../adapters/audit-engine.adapter.js');
    const { CoAuditorAdapter } = await import('../../adapters/co-auditor.adapter.js');
    this.adapter = new CoAuditorAdapter(new AuditEngineAdapter());
    return this.adapter;
  }

  async create(firmId: string, dto: CreateCoAuditorDto): Promise<CoAuditorDto> {
    return (await this.ensureAdapter()).registry.create(firmId, dto);
  }
  async findById(firmId: string, id: string): Promise<CoAuditorDto> {
    return (await this.ensureAdapter()).registry.findById(firmId, id);
  }
  async list(
    firmId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{ items: CoAuditorDto[]; nextCursor: string | null }> {
    return (await this.ensureAdapter()).registry.list(firmId, opts);
  }
  async update(firmId: string, id: string, dto: UpdateCoAuditorDto): Promise<CoAuditorDto> {
    return (await this.ensureAdapter()).registry.update(firmId, id, dto);
  }
  async remove(firmId: string, id: string): Promise<void> {
    return (await this.ensureAdapter()).registry.remove(firmId, id);
  }
}
