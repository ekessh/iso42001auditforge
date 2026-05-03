// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { SoaController } from './soa.controller.js';
import { SoaService } from './soa.service.js';
import { SoaRepository } from './soa.repository.js';
import { SoaAdapter } from '../../adapters/soa.adapter.js';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';

@Module({
  controllers: [SoaController],
  providers: [SoaService, SoaRepository, SoaAdapter, AuditEngineAdapter],
  exports: [SoaService, SoaAdapter],
})
export class SoaModule {}
