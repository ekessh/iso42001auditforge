// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { AuditPlansController } from './audit-plans.controller.js';
import { AuditPlansService } from './audit-plans.service.js';
import { AuditPlansRepository } from './audit-plans.repository.js';
import { AuditPlansAdapter } from '../../adapters/audit-plans.adapter.js';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';

@Module({
  controllers: [AuditPlansController],
  providers: [AuditPlansService, AuditPlansRepository, AuditPlansAdapter, AuditEngineAdapter],
  exports: [AuditPlansService, AuditPlansAdapter],
})
export class AuditPlansModule {}
