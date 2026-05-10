// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { CandidateFindingsModule } from '../candidate-findings/candidate-findings.module.js';
import { CoverageModule } from '../coverage/coverage.module.js';
import { ReadinessController } from './readiness.controller.js';
import { ReadinessService } from './readiness.service.js';

@Module({
  imports: [CandidateFindingsModule, CoverageModule],
  controllers: [ReadinessController],
  providers: [ReadinessService],
  exports: [ReadinessService],
})
export class ReadinessModule {}
