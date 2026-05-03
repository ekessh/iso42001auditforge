// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';
import { FindingsAdapter } from '../../adapters/findings.adapter.js';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { FindingsController } from './findings.controller.js';
import { FindingsRepository } from './findings.repository.js';
import { FindingsService } from './findings.service.js';

@Module({
  controllers: [FindingsController],
  providers: [
    FindingsService,
    FindingsRepository,
    FindingsAdapter,
    AuditEngineAdapter,
    TenancyAdapter,
  ],
  exports: [FindingsService, FindingsAdapter],
})
export class FindingsModule {}
