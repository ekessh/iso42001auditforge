// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { CoverageController } from './coverage.controller.js';
import { CoverageRepository } from './coverage.repository.js';
import { CoverageService } from './coverage.service.js';

@Module({
  controllers: [CoverageController],
  providers: [CoverageService, CoverageRepository, AuditEngineAdapter, TenancyAdapter],
  exports: [CoverageService, CoverageRepository],
})
export class CoverageModule {}
