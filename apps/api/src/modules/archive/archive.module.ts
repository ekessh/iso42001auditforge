// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { ArchiveController } from './archive.controller.js';
import { ArchiveService } from './archive.service.js';
import { ArchiveRepository } from './archive.repository.js';
import { ArchiveAdapter } from '../../adapters/archive.adapter.js';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';

@Module({
  controllers: [ArchiveController],
  providers: [ArchiveService, ArchiveRepository, ArchiveAdapter, AuditEngineAdapter],
  exports: [ArchiveService, ArchiveAdapter],
})
export class ArchiveModule {}
