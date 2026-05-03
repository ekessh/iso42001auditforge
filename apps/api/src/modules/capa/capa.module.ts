// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { CapaController } from './capa.controller.js';
import { CapaService } from './capa.service.js';
import { CapaRepository } from './capa.repository.js';

@Module({
  controllers: [CapaController],
  providers: [CapaService, CapaRepository],
  exports: [CapaService],
})
export class CapaModule {}
