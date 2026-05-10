// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { CrossEngagementMemoryController } from './cross-engagement-memory.controller.js';
import { CrossEngagementMemoryRepository } from './cross-engagement-memory.repository.js';
import { CrossEngagementMemoryService } from './cross-engagement-memory.service.js';

@Module({
  controllers: [CrossEngagementMemoryController],
  providers: [
    CrossEngagementMemoryService,
    CrossEngagementMemoryRepository,
    AuditEngineAdapter,
    TenancyAdapter,
  ],
  exports: [CrossEngagementMemoryService, CrossEngagementMemoryRepository],
})
export class CrossEngagementMemoryModule {}
