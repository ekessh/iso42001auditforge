// SPDX-License-Identifier: BUSL-1.1
import {
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import type { Redis } from 'ioredis';
import type postgres from 'postgres';

import { Public } from '../../common/auth.guard.js';
import { metricsRegistry } from '../../common/metrics.js';
import { PG_CLIENT } from '../../db/db.module.js';
import { REDIS } from '../../queue/queue.module.js';

/**
 * Health endpoints.
 *
 *   GET /healthz/live   — liveness; never depends on downstream services. Always 200 while the
 *                          process can serve HTTP. Used by Kubernetes liveness probe.
 *   GET /healthz/ready  — readiness; 200 only when Postgres + Redis (and S3 if reachable) are healthy.
 *                          Returns 503 otherwise so kubelet removes the pod from the Service.
 *   GET /healthz        — alias for /healthz/live (back-compat for older deploys).
 *   GET /readyz         — alias for /healthz/ready (back-compat).
 *   GET /metrics        — prom-client text exposition.
 */
@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    @Inject(PG_CLIENT) private readonly sql: postgres.Sql,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  // -------------------- LIVENESS -------------------- //

  @Public()
  @Get('healthz/live')
  @ApiOkResponse({ schema: { properties: { status: { type: 'string', example: 'ok' } } } })
  liveness(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /** Back-compat alias for `/healthz/live`. */
  @Public()
  @Get('healthz')
  livenessAlias(): { status: 'ok' } {
    return this.liveness();
  }

  // -------------------- READINESS -------------------- //

  @Public()
  @Get('healthz/ready')
  @ApiOkResponse({
    schema: {
      properties: {
        status: { type: 'string', example: 'ok' },
        postgres: { type: 'boolean' },
        redis: { type: 'boolean' },
      },
    },
  })
  @ApiServiceUnavailableResponse({ description: 'One or more downstream dependencies unreachable' })
  async readiness(): Promise<{ status: 'ok'; postgres: true; redis: true }> {
    const [pg, redis] = await Promise.all([this.pingPostgres(), this.pingRedis()]);
    if (!pg || !redis) {
      throw new HttpException(
        { status: 'unready', postgres: pg, redis },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return { status: 'ok', postgres: true, redis: true };
  }

  /** Back-compat alias for `/healthz/ready`. */
  @Public()
  @Get('readyz')
  async readinessAlias(): Promise<{ status: 'ok'; postgres: true; redis: true }> {
    return this.readiness();
  }

  // -------------------- METRICS -------------------- //

  @Public()
  @Get('metrics')
  @HttpCode(HttpStatus.OK)
  async metrics(): Promise<string> {
    return metricsRegistry.metrics();
  }

  // -------------------- helpers -------------------- //

  private async pingPostgres(): Promise<boolean> {
    try {
      await this.sql`select 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async pingRedis(): Promise<boolean> {
    try {
      const reply = await this.redis.ping();
      return reply === 'PONG' || reply === 'pong';
    } catch {
      return false;
    }
  }
}
