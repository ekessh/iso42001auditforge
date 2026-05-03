// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { CrossFrameworkController } from './cross-framework.controller.js';
import { CrossFrameworkService } from './cross-framework.service.js';
import { CrossFrameworkRepository } from './cross-framework.repository.js';

@Module({
  controllers: [CrossFrameworkController],
  providers: [CrossFrameworkService, CrossFrameworkRepository],
  exports: [CrossFrameworkService],
})
export class CrossFrameworkModule {}
