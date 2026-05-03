// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { SamplesController } from './samples.controller.js';
import { SamplesService } from './samples.service.js';
import { SamplesRepository } from './samples.repository.js';

@Module({
  controllers: [SamplesController],
  providers: [SamplesService, SamplesRepository],
  exports: [SamplesService],
})
export class SamplesModule {}
