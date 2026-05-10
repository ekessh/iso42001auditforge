// SPDX-License-Identifier: BUSL-1.1
import { Inject, Injectable, Optional } from '@nestjs/common';
import type { CreateAgentWorkflowsDto, UpdateAgentWorkflowsDto, AgentWorkflowsDto } from './dto.js';
import type { AgentWorkflowsRepository } from './agent-workflows.repository.js';
import { TraceAnalyzerAdapter } from '../../adapters/trace-analyzer.adapter.js';

@Injectable()
export class AgentWorkflowsService {
  constructor(
    private readonly repo: AgentWorkflowsRepository,
    @Optional() @Inject(TraceAnalyzerAdapter) private readonly adapter?: TraceAnalyzerAdapter,
  ) {}

  create(firmId: string, dto: CreateAgentWorkflowsDto): Promise<AgentWorkflowsDto> {
    return this.repo.create(firmId, dto);
  }
  get(firmId: string, id: string): Promise<AgentWorkflowsDto> {
    return this.repo.findById(firmId, id);
  }
  list(
    firmId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{ items: AgentWorkflowsDto[]; nextCursor: string | null }> {
    return this.repo.list(firmId, opts);
  }
  update(firmId: string, id: string, dto: UpdateAgentWorkflowsDto): Promise<AgentWorkflowsDto> {
    return this.repo.update(firmId, id, dto);
  }
  remove(firmId: string, id: string): Promise<void> {
    return this.repo.remove(firmId, id);
  }

  /** Pass-through to topology + tool-registry + recursion-limit verifiers. */
  topology(): TraceAnalyzerAdapter | null {
    return this.adapter ?? null;
  }
}
