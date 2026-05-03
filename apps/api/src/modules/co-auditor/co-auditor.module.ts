// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { CoAuditorController } from './co-auditor.controller.js';
import { CoAuditorService } from './co-auditor.service.js';
import { CoAuditorRepository } from './co-auditor.repository.js';
import { CoAuditorAdapter } from '../../adapters/co-auditor.adapter.js';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';

@Module({
  controllers: [CoAuditorController],
  providers: [CoAuditorService, CoAuditorRepository, CoAuditorAdapter, AuditEngineAdapter],
  exports: [CoAuditorService, CoAuditorAdapter],
})
export class CoAuditorModule {}
