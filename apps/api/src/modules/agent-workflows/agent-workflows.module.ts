// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { AgentWorkflowsController } from './agent-workflows.controller.js';
import { AgentWorkflowsService } from './agent-workflows.service.js';
import { AgentWorkflowsRepository } from './agent-workflows.repository.js';
import { TraceAnalyzerAdapter } from '../../adapters/trace-analyzer.adapter.js';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';

@Module({
  controllers: [AgentWorkflowsController],
  providers: [AgentWorkflowsService, AgentWorkflowsRepository, TraceAnalyzerAdapter, AuditEngineAdapter],
  exports: [AgentWorkflowsService, TraceAnalyzerAdapter],
})
export class AgentWorkflowsModule {}
