// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { SamplesController } from './samples.controller.js';
import { SamplesService } from './samples.service.js';
import { SamplesRepository } from './samples.repository.js';
import { SamplingAdapter } from '../../adapters/sampling.adapter.js';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';

@Module({
  controllers: [SamplesController],
  providers: [SamplesService, SamplesRepository, SamplingAdapter, AuditEngineAdapter],
  exports: [SamplesService, SamplingAdapter],
})
export class SamplesModule {}
