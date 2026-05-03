// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { EngagementsController } from './engagements.controller.js';
import { EngagementsRepository } from './engagements.repository.js';
import { EngagementsService } from './engagements.service.js';
import { EngagementAdapter } from '../../adapters/engagement.adapter.js';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';

@Module({
  controllers: [EngagementsController],
  providers: [EngagementsService, EngagementsRepository, EngagementAdapter, AuditEngineAdapter],
  exports: [EngagementsService, EngagementAdapter],
})
export class EngagementsModule {}
