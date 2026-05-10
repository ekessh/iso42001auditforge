// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../db/base.repository.js';
import type { InterviewsDto, CreateInterviewsDto, UpdateInterviewsDto } from './dto.js';
import type { InterviewsAdapter } from '../../adapters/interviews.adapter.js';

@Injectable()
export class InterviewsRepository extends BaseRepository {
  private adapter: InterviewsAdapter | null;

  constructor(...args: unknown[]) {
    super(args[0] as never, args[1] as never);
    this.adapter = (args[2] as InterviewsAdapter | undefined) ?? null;
  }

  private async ensureAdapter(): Promise<InterviewsAdapter> {
    if (this.adapter) return this.adapter;
    const { AuditEngineAdapter } = await import('../../adapters/audit-engine.adapter.js');
    const { InterviewsAdapter } = await import('../../adapters/interviews.adapter.js');
    this.adapter = new InterviewsAdapter(new AuditEngineAdapter());
    return this.adapter;
  }

  async create(firmId: string, dto: CreateInterviewsDto): Promise<InterviewsDto> {
    return (await this.ensureAdapter()).registry.create(firmId, dto);
  }
  async findById(firmId: string, id: string): Promise<InterviewsDto> {
    return (await this.ensureAdapter()).registry.findById(firmId, id);
  }
  async list(
    firmId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{ items: InterviewsDto[]; nextCursor: string | null }> {
    return (await this.ensureAdapter()).registry.list(firmId, opts);
  }
  async update(firmId: string, id: string, dto: UpdateInterviewsDto): Promise<InterviewsDto> {
    return (await this.ensureAdapter()).registry.update(firmId, id, dto);
  }
  async remove(firmId: string, id: string): Promise<void> {
    return (await this.ensureAdapter()).registry.remove(firmId, id);
  }
}
