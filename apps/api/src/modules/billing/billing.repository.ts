// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../db/base.repository.js';
import type { BillingDto, CreateBillingDto, UpdateBillingDto } from './dto.js';
import type { BillingAdapter } from '../../adapters/billing.adapter.js';

@Injectable()
export class BillingRepository extends BaseRepository {
  private adapter: BillingAdapter | null;

  constructor(...args: unknown[]) {
    super(args[0] as never, args[1] as never);
    this.adapter = (args[2] as BillingAdapter | undefined) ?? null;
  }

  private async ensureAdapter(): Promise<BillingAdapter> {
    if (this.adapter) return this.adapter;
    const { AuditEngineAdapter } = await import('../../adapters/audit-engine.adapter.js');
    const { BillingAdapter } = await import('../../adapters/billing.adapter.js');
    this.adapter = new BillingAdapter(new AuditEngineAdapter());
    return this.adapter;
  }

  async create(firmId: string, dto: CreateBillingDto): Promise<BillingDto> {
    return (await this.ensureAdapter()).registry.create(firmId, dto);
  }
  async findById(firmId: string, id: string): Promise<BillingDto> {
    return (await this.ensureAdapter()).registry.findById(firmId, id);
  }
  async list(
    firmId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{ items: BillingDto[]; nextCursor: string | null }> {
    return (await this.ensureAdapter()).registry.list(firmId, opts);
  }
  async update(firmId: string, id: string, dto: UpdateBillingDto): Promise<BillingDto> {
    return (await this.ensureAdapter()).registry.update(firmId, id, dto);
  }
  async remove(firmId: string, id: string): Promise<void> {
    return (await this.ensureAdapter()).registry.remove(firmId, id);
  }
}
