// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';
import { ProbesAdapter } from '../../adapters/probes.adapter.js';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { ProbesController } from './probes.controller.js';
import { ProbesRepository } from './probes.repository.js';
import { ProbesService } from './probes.service.js';

@Module({
  controllers: [ProbesController],
  providers: [
    ProbesService,
    ProbesRepository,
    ProbesAdapter,
    AuditEngineAdapter,
    TenancyAdapter,
  ],
  exports: [ProbesService, ProbesAdapter],
})
export class ProbesModule {}
