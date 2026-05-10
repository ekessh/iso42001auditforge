// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../db/base.repository.js';
import type { SoaDto, CreateSoaDto, UpdateSoaDto } from './dto.js';
import type { SoaAdapter } from '../../adapters/soa.adapter.js';

@Injectable()
export class SoaRepository extends BaseRepository {
  private adapter: SoaAdapter | null;

  constructor(...args: unknown[]) {
    super(args[0] as never, args[1] as never);
    this.adapter = (args[2] as SoaAdapter | undefined) ?? null;
  }

  private async ensureAdapter(): Promise<SoaAdapter> {
    if (this.adapter) return this.adapter;
    const { AuditEngineAdapter } = await import('../../adapters/audit-engine.adapter.js');
    const { SoaAdapter } = await import('../../adapters/soa.adapter.js');
    this.adapter = new SoaAdapter(new AuditEngineAdapter());
    return this.adapter;
  }

  async create(firmId: string, dto: CreateSoaDto): Promise<SoaDto> {
    return (await this.ensureAdapter()).registry.create(firmId, dto);
  }
  async findById(firmId: string, id: string): Promise<SoaDto> {
    return (await this.ensureAdapter()).registry.findById(firmId, id);
  }
  async list(
    firmId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{ items: SoaDto[]; nextCursor: string | null }> {
    return (await this.ensureAdapter()).registry.list(firmId, opts);
  }
  async update(firmId: string, id: string, dto: UpdateSoaDto): Promise<SoaDto> {
    return (await this.ensureAdapter()).registry.update(firmId, id, dto);
  }
  async remove(firmId: string, id: string): Promise<void> {
    return (await this.ensureAdapter()).registry.remove(firmId, id);
  }
}
