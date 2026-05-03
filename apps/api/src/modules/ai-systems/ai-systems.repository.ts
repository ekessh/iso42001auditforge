// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../db/base.repository.js';
import type { AiSystemsDto, CreateAiSystemsDto, UpdateAiSystemsDto } from './dto.js';
import { AiSystemsAdapter } from '../../adapters/ai-systems.adapter.js';

@Injectable()
export class AiSystemsRepository extends BaseRepository {
  private adapter: AiSystemsAdapter | null;

  constructor(...args: unknown[]) {
    super(args[0] as never, args[1] as never);
    this.adapter = (args[2] as AiSystemsAdapter | undefined) ?? null;
  }

  private async ensureAdapter(): Promise<AiSystemsAdapter> {
    if (this.adapter) return this.adapter;
    const { AuditEngineAdapter } = await import('../../adapters/audit-engine.adapter.js');
    const { AiSystemsAdapter } = await import('../../adapters/ai-systems.adapter.js');
    this.adapter = new AiSystemsAdapter(new AuditEngineAdapter());
    return this.adapter;
  }

  async create(firmId: string, dto: CreateAiSystemsDto): Promise<AiSystemsDto> {
    return (await this.ensureAdapter()).registry.create(firmId, dto);
  }
  async findById(firmId: string, id: string): Promise<AiSystemsDto> {
    return (await this.ensureAdapter()).registry.findById(firmId, id);
  }
  async list(
    firmId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{ items: AiSystemsDto[]; nextCursor: string | null }> {
    return (await this.ensureAdapter()).registry.list(firmId, opts);
  }
  async update(firmId: string, id: string, dto: UpdateAiSystemsDto): Promise<AiSystemsDto> {
    return (await this.ensureAdapter()).registry.update(firmId, id, dto);
  }
  async remove(firmId: string, id: string): Promise<void> {
    return (await this.ensureAdapter()).registry.remove(firmId, id);
  }
}
