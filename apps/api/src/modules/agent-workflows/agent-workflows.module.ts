// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { AgentWorkflowsController } from './agent-workflows.controller.js';
import { AgentWorkflowsService } from './agent-workflows.service.js';
import { AgentWorkflowsRepository } from './agent-workflows.repository.js';

@Module({
  controllers: [AgentWorkflowsController],
  providers: [AgentWorkflowsService, AgentWorkflowsRepository],
  exports: [AgentWorkflowsService],
})
export class AgentWorkflowsModule {}
