// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import type { CreateAgentWorkflowsDto, UpdateAgentWorkflowsDto, AgentWorkflowsDto } from './dto.js';
import { AgentWorkflowsRepository } from './agent-workflows.repository.js';

@Injectable()
export class AgentWorkflowsService {
  constructor(private readonly repo: AgentWorkflowsRepository) {}

  create(firmId: string, dto: CreateAgentWorkflowsDto): Promise<AgentWorkflowsDto> { return this.repo.create(firmId, dto); }
  get(firmId: string, id: string): Promise<AgentWorkflowsDto> { return this.repo.findById(firmId, id); }
  list(firmId: string, opts: { cursor?: string; limit: number }): Promise<{ items: AgentWorkflowsDto[]; nextCursor: string | null }> { return this.repo.list(firmId, opts); }
  update(firmId: string, id: string, dto: UpdateAgentWorkflowsDto): Promise<AgentWorkflowsDto> { return this.repo.update(firmId, id, dto); }
  remove(firmId: string, id: string): Promise<void> { return this.repo.remove(firmId, id); }
}
