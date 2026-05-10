// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { LibraryController } from './library.controller.js';
import { LibraryRepository } from './library.repository.js';
import { LibraryService } from './library.service.js';

@Module({
  controllers: [LibraryController],
  providers: [LibraryService, LibraryRepository, TenancyAdapter],
  exports: [LibraryService, LibraryRepository],
})
export class LibraryModule {}
