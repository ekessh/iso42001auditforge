// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { CandidateFindingsModule } from '../candidate-findings/candidate-findings.module.js';
import { CoverageModule } from '../coverage/coverage.module.js';
import { FindingsModule } from '../findings/findings.module.js';
import { AuditDashboardController } from './audit-dashboard.controller.js';
import { AuditDashboardService } from './audit-dashboard.service.js';

@Module({
  imports: [CandidateFindingsModule, CoverageModule, FindingsModule],
  controllers: [AuditDashboardController],
  providers: [AuditDashboardService],
  exports: [AuditDashboardService],
})
export class AuditDashboardModule {}
