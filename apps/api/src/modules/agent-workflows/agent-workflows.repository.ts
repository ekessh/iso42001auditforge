// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../db/base.repository.js';
import type { AgentWorkflowsDto, CreateAgentWorkflowsDto, UpdateAgentWorkflowsDto } from './dto.js';
import { TraceAnalyzerAdapter } from '../../adapters/trace-analyzer.adapter.js';

@Injectable()
export class AgentWorkflowsRepository extends BaseRepository {
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

  async create(firmId: string, dto: CreateAgentWorkflowsDto): Promise<AgentWorkflowsDto> {
    return (await this.ensureAdapter()).workflowsRegistry.create(firmId, dto);
  }
  async findById(firmId: string, id: string): Promise<AgentWorkflowsDto> {
    return (await this.ensureAdapter()).workflowsRegistry.findById(firmId, id);
  }
  async list(
    firmId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{ items: AgentWorkflowsDto[]; nextCursor: string | null }> {
    return (await this.ensureAdapter()).workflowsRegistry.list(firmId, opts);
  }
  async update(firmId: string, id: string, dto: UpdateAgentWorkflowsDto): Promise<AgentWorkflowsDto> {
    return (await this.ensureAdapter()).workflowsRegistry.update(firmId, id, dto);
  }
  async remove(firmId: string, id: string): Promise<void> {
    return (await this.ensureAdapter()).workflowsRegistry.remove(firmId, id);
  }
}
