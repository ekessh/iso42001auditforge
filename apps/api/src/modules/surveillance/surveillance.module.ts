// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { SurveillanceController } from './surveillance.controller.js';
import { SurveillanceService } from './surveillance.service.js';
import { SurveillanceRepository } from './surveillance.repository.js';
import { SurveillanceAdapter } from '../../adapters/surveillance.adapter.js';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';

@Module({
  controllers: [SurveillanceController],
  providers: [SurveillanceService, SurveillanceRepository, SurveillanceAdapter, AuditEngineAdapter],
  exports: [SurveillanceService, SurveillanceAdapter],
})
export class SurveillanceModule {}
