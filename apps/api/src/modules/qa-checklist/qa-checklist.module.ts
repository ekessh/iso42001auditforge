// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { QaChecklistController } from './qa-checklist.controller.js';
import { QaChecklistService } from './qa-checklist.service.js';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';

@Module({
  controllers: [QaChecklistController],
  providers: [QaChecklistService, AuditEngineAdapter],
  exports: [QaChecklistService],
})
export class QaChecklistModule {}
