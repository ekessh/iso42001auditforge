// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { InterviewsController } from './interviews.controller.js';
import { InterviewsService } from './interviews.service.js';
import { InterviewsRepository } from './interviews.repository.js';
import { InterviewsAdapter } from '../../adapters/interviews.adapter.js';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';

@Module({
  controllers: [InterviewsController],
  providers: [InterviewsService, InterviewsRepository, InterviewsAdapter, AuditEngineAdapter],
  exports: [InterviewsService, InterviewsAdapter],
})
export class InterviewsModule {}
