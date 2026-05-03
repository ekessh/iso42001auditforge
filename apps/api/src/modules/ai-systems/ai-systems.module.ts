// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { AiSystemsController } from './ai-systems.controller.js';
import { AiSystemsService } from './ai-systems.service.js';
import { AiSystemsRepository } from './ai-systems.repository.js';

@Module({
  controllers: [AiSystemsController],
  providers: [AiSystemsService, AiSystemsRepository],
  exports: [AiSystemsService],
})
export class AiSystemsModule {}
