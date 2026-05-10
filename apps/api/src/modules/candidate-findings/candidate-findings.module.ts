// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { FindingsModule } from '../findings/findings.module.js';
import { CandidateFindingsController } from './candidate-findings.controller.js';
import { CandidateFindingsRepository } from './candidate-findings.repository.js';
import { CandidateFindingsService } from './candidate-findings.service.js';

@Module({
  imports: [FindingsModule],
  controllers: [CandidateFindingsController],
  providers: [CandidateFindingsService, CandidateFindingsRepository, TenancyAdapter],
  exports: [CandidateFindingsService, CandidateFindingsRepository],
})
export class CandidateFindingsModule {}
