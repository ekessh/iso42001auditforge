// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { CrossFrameworkController } from './cross-framework.controller.js';
import { CrossFrameworkService } from './cross-framework.service.js';
import { CrossFrameworkRepository } from './cross-framework.repository.js';
import { CrossFrameworkAdapter } from '../../adapters/cross-framework.adapter.js';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';

@Module({
  controllers: [CrossFrameworkController],
  providers: [CrossFrameworkService, CrossFrameworkRepository, CrossFrameworkAdapter, AuditEngineAdapter],
  exports: [CrossFrameworkService, CrossFrameworkAdapter],
})
export class CrossFrameworkModule {}
