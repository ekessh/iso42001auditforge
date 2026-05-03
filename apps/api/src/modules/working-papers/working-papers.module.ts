// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { WorkingPapersController } from './working-papers.controller.js';
import { WorkingPapersRepository } from './working-papers.repository.js';
import { WorkingPapersService } from './working-papers.service.js';

@Module({
  controllers: [WorkingPapersController],
  providers: [WorkingPapersService, WorkingPapersRepository],
  exports: [WorkingPapersService],
})
export class WorkingPapersModule {}
