// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../db/base.repository.js';
import type { SurveillanceDto, CreateSurveillanceDto, UpdateSurveillanceDto } from './dto.js';
import type { SurveillanceAdapter } from '../../adapters/surveillance.adapter.js';

@Injectable()
export class SurveillanceRepository extends BaseRepository {
  private adapter: SurveillanceAdapter | null;

  constructor(...args: unknown[]) {
    super(args[0] as never, args[1] as never);
    this.adapter = (args[2] as SurveillanceAdapter | undefined) ?? null;
  }

  private async ensureAdapter(): Promise<SurveillanceAdapter> {
    if (this.adapter) return this.adapter;
    const { AuditEngineAdapter } = await import('../../adapters/audit-engine.adapter.js');
    const { SurveillanceAdapter } = await import('../../adapters/surveillance.adapter.js');
    this.adapter = new SurveillanceAdapter(new AuditEngineAdapter());
    return this.adapter;
  }

  async create(firmId: string, dto: CreateSurveillanceDto): Promise<SurveillanceDto> {
    return (await this.ensureAdapter()).registry.create(firmId, dto);
  }
  async findById(firmId: string, id: string): Promise<SurveillanceDto> {
    return (await this.ensureAdapter()).registry.findById(firmId, id);
  }
  async list(
    firmId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{ items: SurveillanceDto[]; nextCursor: string | null }> {
    return (await this.ensureAdapter()).registry.list(firmId, opts);
  }
  async update(firmId: string, id: string, dto: UpdateSurveillanceDto): Promise<SurveillanceDto> {
    return (await this.ensureAdapter()).registry.update(firmId, id, dto);
  }
  async remove(firmId: string, id: string): Promise<void> {
    return (await this.ensureAdapter()).registry.remove(firmId, id);
  }
}
