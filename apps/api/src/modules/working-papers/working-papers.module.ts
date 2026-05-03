// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { WorkingPapersAdapter } from '../../adapters/working-papers.adapter.js';
import { WorkingPapersController } from './working-papers.controller.js';
import { WorkingPapersRepository } from './working-papers.repository.js';
import { WorkingPapersService } from './working-papers.service.js';

@Module({
  controllers: [WorkingPapersController],
  providers: [
    WorkingPapersService,
    WorkingPapersRepository,
    WorkingPapersAdapter,
    AuditEngineAdapter,
    TenancyAdapter,
  ],
  exports: [WorkingPapersService, WorkingPapersAdapter],
})
export class WorkingPapersModule {}
