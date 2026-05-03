// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { ArchiveController } from './archive.controller.js';
import { ArchiveService } from './archive.service.js';
import { ArchiveRepository } from './archive.repository.js';

@Module({
  controllers: [ArchiveController],
  providers: [ArchiveService, ArchiveRepository],
  exports: [ArchiveService],
})
export class ArchiveModule {}
