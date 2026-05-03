// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { RisksController } from './risks.controller.js';
import { RisksService } from './risks.service.js';
import { RisksRepository } from './risks.repository.js';
import { RisksAdapter } from '../../adapters/risks.adapter.js';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';

@Module({
  controllers: [RisksController],
  providers: [RisksService, RisksRepository, RisksAdapter, AuditEngineAdapter],
  exports: [RisksService, RisksAdapter],
})
export class RisksModule {}
