// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { WorkingPapersSyncController } from './working-papers-sync.controller.js';
import { WorkingPapersSyncService } from './working-papers-sync.service.js';
import { WorkingPapersSyncRepository } from './working-papers-sync.repository.js';
import { WorkingPapersSyncGateway } from './working-papers-sync.gateway.js';

@Module({
  controllers: [WorkingPapersSyncController],
  providers: [
    WorkingPapersSyncService,
    WorkingPapersSyncRepository,
    WorkingPapersSyncGateway,
    AuditEngineAdapter,
    TenancyAdapter,
  ],
  exports: [WorkingPapersSyncService, WorkingPapersSyncGateway],
})
export class WorkingPapersSyncModule {}
