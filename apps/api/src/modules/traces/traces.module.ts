// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { TracesController } from './traces.controller.js';
import { TracesService } from './traces.service.js';
import { TracesRepository } from './traces.repository.js';

@Module({
  controllers: [TracesController],
  providers: [TracesService, TracesRepository],
  exports: [TracesService],
})
export class TracesModule {}
