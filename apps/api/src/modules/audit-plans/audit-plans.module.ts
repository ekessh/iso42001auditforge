// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { AuditPlansController } from './audit-plans.controller.js';
import { AuditPlansService } from './audit-plans.service.js';
import { AuditPlansRepository } from './audit-plans.repository.js';

@Module({
  controllers: [AuditPlansController],
  providers: [AuditPlansService, AuditPlansRepository],
  exports: [AuditPlansService],
})
export class AuditPlansModule {}
