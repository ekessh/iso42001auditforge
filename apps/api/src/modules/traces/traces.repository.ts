// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../db/base.repository.js';
import type { TracesDto, CreateTracesDto, UpdateTracesDto } from './dto.js';
import { TraceAnalyzerAdapter } from '../../adapters/trace-analyzer.adapter.js';

@Injectable()
export class TracesRepository extends BaseRepository {
  private adapter: TraceAnalyzerAdapter | null;

  constructor(...args: unknown[]) {
    super(args[0] as never, args[1] as never);
    this.adapter = (args[2] as TraceAnalyzerAdapter | undefined) ?? null;
  }

  private async ensureAdapter(): Promise<TraceAnalyzerAdapter> {
    if (this.adapter) return this.adapter;
    const { AuditEngineAdapter } = await import('../../adapters/audit-engine.adapter.js');
    const { TraceAnalyzerAdapter } = await import('../../adapters/trace-analyzer.adapter.js');
    this.adapter = new TraceAnalyzerAdapter(new AuditEngineAdapter());
    return this.adapter;
  }

  async create(firmId: string, dto: CreateTracesDto): Promise<TracesDto> {
    return (await this.ensureAdapter()).tracesRegistry.create(firmId, dto);
  }
  async findById(firmId: string, id: string): Promise<TracesDto> {
    return (await this.ensureAdapter()).tracesRegistry.findById(firmId, id);
  }
  async list(
    firmId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{ items: TracesDto[]; nextCursor: string | null }> {
    return (await this.ensureAdapter()).tracesRegistry.list(firmId, opts);
  }
  async update(firmId: string, id: string, dto: UpdateTracesDto): Promise<TracesDto> {
    return (await this.ensureAdapter()).tracesRegistry.update(firmId, id, dto);
  }
  async remove(firmId: string, id: string): Promise<void> {
    return (await this.ensureAdapter()).tracesRegistry.remove(firmId, id);
  }
}
