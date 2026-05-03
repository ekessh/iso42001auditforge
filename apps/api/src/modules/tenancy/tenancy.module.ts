// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { TenancyController } from './tenancy.controller.js';
import { TenancyService } from './tenancy.service.js';
import { TenancyRepository } from './tenancy.repository.js';

@Module({
  controllers: [TenancyController],
  providers: [TenancyService, TenancyRepository],
  exports: [TenancyService],
})
export class TenancyModule {}
