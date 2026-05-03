// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { SoaController } from './soa.controller.js';
import { SoaService } from './soa.service.js';
import { SoaRepository } from './soa.repository.js';

@Module({
  controllers: [SoaController],
  providers: [SoaService, SoaRepository],
  exports: [SoaService],
})
export class SoaModule {}
