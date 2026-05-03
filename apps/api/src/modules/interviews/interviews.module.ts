// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { InterviewsController } from './interviews.controller.js';
import { InterviewsService } from './interviews.service.js';
import { InterviewsRepository } from './interviews.repository.js';

@Module({
  controllers: [InterviewsController],
  providers: [InterviewsService, InterviewsRepository],
  exports: [InterviewsService],
})
export class InterviewsModule {}
