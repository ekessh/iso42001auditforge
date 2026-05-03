// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../db/base.repository.js';
import type { AuditPlansDto, CreateAuditPlansDto, UpdateAuditPlansDto } from './dto.js';
import { AuditPlansAdapter } from '../../adapters/audit-plans.adapter.js';

@Injectable()
export class AuditPlansRepository extends BaseRepository {
  private adapter: AuditPlansAdapter | null;

  constructor(...args: unknown[]) {
    super(args[0] as never, args[1] as never);
    this.adapter = (args[2] as AuditPlansAdapter | undefined) ?? null;
  }

  private async ensureAdapter(): Promise<AuditPlansAdapter> {
    if (this.adapter) return this.adapter;
    const { AuditEngineAdapter } = await import('../../adapters/audit-engine.adapter.js');
    const { AuditPlansAdapter } = await import('../../adapters/audit-plans.adapter.js');
    this.adapter = new AuditPlansAdapter(new AuditEngineAdapter());
    return this.adapter;
  }

  async create(firmId: string, dto: CreateAuditPlansDto): Promise<AuditPlansDto> {
    return (await this.ensureAdapter()).registry.create(firmId, dto);
  }
  async findById(firmId: string, id: string): Promise<AuditPlansDto> {
    return (await this.ensureAdapter()).registry.findById(firmId, id);
  }
  async list(
    firmId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{ items: AuditPlansDto[]; nextCursor: string | null }> {
    return (await this.ensureAdapter()).registry.list(firmId, opts);
  }
  async update(firmId: string, id: string, dto: UpdateAuditPlansDto): Promise<AuditPlansDto> {
    return (await this.ensureAdapter()).registry.update(firmId, id, dto);
  }
  async remove(firmId: string, id: string): Promise<void> {
    return (await this.ensureAdapter()).registry.remove(firmId, id);
  }
}
