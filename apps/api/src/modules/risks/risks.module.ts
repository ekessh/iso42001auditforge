// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { RisksController } from './risks.controller.js';
import { RisksService } from './risks.service.js';
import { RisksRepository } from './risks.repository.js';

@Module({
  controllers: [RisksController],
  providers: [RisksService, RisksRepository],
  exports: [RisksService],
})
export class RisksModule {}
