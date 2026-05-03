// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { CapaController } from './capa.controller.js';
import { CapaService } from './capa.service.js';
import { CapaRepository } from './capa.repository.js';
import { CapaAdapter } from '../../adapters/capa.adapter.js';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';

@Module({
  controllers: [CapaController],
  providers: [CapaService, CapaRepository, CapaAdapter, AuditEngineAdapter],
  exports: [CapaService, CapaAdapter],
})
export class CapaModule {}
