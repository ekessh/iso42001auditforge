// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';
import { BillingRepository } from './billing.repository.js';
import { BillingAdapter } from '../../adapters/billing.adapter.js';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';

@Module({
  controllers: [BillingController],
  providers: [BillingService, BillingRepository, BillingAdapter, AuditEngineAdapter],
  exports: [BillingService, BillingAdapter],
})
export class BillingModule {}
