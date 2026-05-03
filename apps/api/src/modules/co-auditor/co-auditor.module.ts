// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { CoAuditorController } from './co-auditor.controller.js';
import { CoAuditorService } from './co-auditor.service.js';
import { CoAuditorRepository } from './co-auditor.repository.js';

@Module({
  controllers: [CoAuditorController],
  providers: [CoAuditorService, CoAuditorRepository],
  exports: [CoAuditorService],
})
export class CoAuditorModule {}
