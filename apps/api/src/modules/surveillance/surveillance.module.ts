// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { SurveillanceController } from './surveillance.controller.js';
import { SurveillanceService } from './surveillance.service.js';
import { SurveillanceRepository } from './surveillance.repository.js';

@Module({
  controllers: [SurveillanceController],
  providers: [SurveillanceService, SurveillanceRepository],
  exports: [SurveillanceService],
})
export class SurveillanceModule {}
