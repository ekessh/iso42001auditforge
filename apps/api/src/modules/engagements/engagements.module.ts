// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { EngagementsController } from './engagements.controller.js';
import { EngagementsRepository } from './engagements.repository.js';
import { EngagementsService } from './engagements.service.js';

@Module({
  controllers: [EngagementsController],
  providers: [EngagementsService, EngagementsRepository],
  exports: [EngagementsService],
})
export class EngagementsModule {}
