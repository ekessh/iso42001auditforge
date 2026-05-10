// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { FindingsController } from './findings.controller.js';
import { FindingsRepository } from './findings.repository.js';
import { FindingsService } from './findings.service.js';

@Module({
  controllers: [FindingsController],
  providers: [FindingsService, FindingsRepository, TenancyAdapter],
  exports: [FindingsService, FindingsRepository],
})
export class FindingsModule {}
