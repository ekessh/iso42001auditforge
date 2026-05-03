// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { ProbesController } from './probes.controller.js';
import { ProbesRepository } from './probes.repository.js';
import { ProbesService } from './probes.service.js';

@Module({
  controllers: [ProbesController],
  providers: [ProbesService, ProbesRepository],
  exports: [ProbesService],
})
export class ProbesModule {}
