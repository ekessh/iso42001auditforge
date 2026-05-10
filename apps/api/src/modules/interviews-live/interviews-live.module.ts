// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';
import { InterviewsLiveController } from './interviews-live.controller.js';
import { InterviewsLiveGateway } from './interviews-live.gateway.js';
import { InterviewsLiveService } from './interviews-live.service.js';

@Module({
  controllers: [InterviewsLiveController],
  providers: [InterviewsLiveService, InterviewsLiveGateway, AuditEngineAdapter],
  exports: [InterviewsLiveService],
})
export class InterviewsLiveModule {}
