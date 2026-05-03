// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { FindingsController } from './findings.controller.js';
import { FindingsRepository } from './findings.repository.js';
import { FindingsService } from './findings.service.js';

@Module({
  controllers: [FindingsController],
  providers: [FindingsService, FindingsRepository],
  exports: [FindingsService],
})
export class FindingsModule {}
