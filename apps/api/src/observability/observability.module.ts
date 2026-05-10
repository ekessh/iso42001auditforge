// SPDX-License-Identifier: BUSL-1.1
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { ObservabilitySpanInterceptor } from './span.interceptor.js';
import { ObservabilityExceptionFilter } from './exception.filter.js';
import { ObservabilityController } from './observability.controller.js';
import { DepsHealthService } from './deps-health.service.js';
import { SurveillanceTimelineController } from './surveillance-timeline.controller.js';

@Module({
  controllers: [ObservabilityController, SurveillanceTimelineController],
  providers: [
    DepsHealthService,
    { provide: APP_INTERCEPTOR, useClass: ObservabilitySpanInterceptor },
    { provide: APP_FILTER, useClass: ObservabilityExceptionFilter },
  ],
  exports: [DepsHealthService],
})
export class ObservabilityModule {}
