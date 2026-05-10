// SPDX-License-Identifier: BUSL-1.1
/**
 * Observability ingest + health surface.
 *
 *   GET  /healthz           — full deps health snapshot (200 ok / 503 unhealthy).
 *   POST /v1/observability/web-vitals  — RUM web-vitals batch.
 *   POST /v1/observability/errors      — RUM browser-side error reports.
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  UsePipes,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import {
  observabilityErrorsBatchSchema,
  redactValue,
  webVitalsBatchSchema,
  type ObservabilityErrorsBatch,
  type WebVitalsBatch,
} from '@auditforge/observability';

import { Public } from '../common/auth.guard.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { DepsHealthService, type HealthSnapshot } from './deps-health.service.js';

@ApiTags('observability')
@Controller()
export class ObservabilityController {
  constructor(private readonly deps: DepsHealthService) {}

  @Public()
  @Get('healthz/deps')
  @ApiOkResponse({ description: 'Deep deps health snapshot' })
  async health(): Promise<HealthSnapshot> {
    const snap = await this.deps.snapshot();
    if (snap.status === 'down') {
      throw new HttpException(snap, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return snap;
  }

  @Public()
  @Post('v1/observability/web-vitals')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UsePipes(new ZodValidationPipe(webVitalsBatchSchema))
  async webVitals(@Body() body: WebVitalsBatch): Promise<void> {
    void redactValue(body);
  }

  @Public()
  @Post('v1/observability/errors')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UsePipes(new ZodValidationPipe(observabilityErrorsBatchSchema))
  async errors(@Body() body: ObservabilityErrorsBatch): Promise<void> {
    void redactValue(body);
  }
}
