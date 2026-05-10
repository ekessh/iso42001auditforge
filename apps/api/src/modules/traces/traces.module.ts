// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { TracesController } from './traces.controller.js';
import { TracesService } from './traces.service.js';
import { TracesRepository } from './traces.repository.js';
import { TraceAnalyzerAdapter } from '../../adapters/trace-analyzer.adapter.js';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';

@Module({
  controllers: [TracesController],
  providers: [
    TracesService,
    TracesRepository,
    TraceAnalyzerAdapter,
    AuditEngineAdapter,
    TenancyAdapter,
  ],
  exports: [TracesService, TraceAnalyzerAdapter],
})
export class TracesModule {}
