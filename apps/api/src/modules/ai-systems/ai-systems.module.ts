// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { AiSystemsController } from './ai-systems.controller.js';
import { AiSystemsService } from './ai-systems.service.js';
import { AiSystemsRepository } from './ai-systems.repository.js';
import { AiSystemsAdapter } from '../../adapters/ai-systems.adapter.js';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';

@Module({
  controllers: [AiSystemsController],
  providers: [AiSystemsService, AiSystemsRepository, AiSystemsAdapter, AuditEngineAdapter],
  exports: [AiSystemsService, AiSystemsAdapter],
})
export class AiSystemsModule {}
