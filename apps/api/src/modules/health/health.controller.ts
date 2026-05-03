// SPDX-License-Identifier: BUSL-1.1
import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/auth.guard.js';
import { metricsRegistry } from '../../common/metrics.js';
import { PG_CLIENT } from '../../db/db.module.js';
import { REDIS } from '../../queue/queue.module.js';
import type postgres from 'postgres';
import type { Redis } from 'ioredis';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(
    @Inject(PG_CLIENT) private readonly sql: postgres.Sql,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Public()
  @Get('healthz')
  @ApiOkResponse({ schema: { properties: { status: { type: 'string', example: 'ok' } } } })
  liveness(): { status: string } {
    return { status: 'ok' };
  }

  @Public()
  @Get('readyz')
  @ApiOkResponse({ schema: { properties: { status: { type: 'string' }, postgres: { type: 'boolean' }, redis: { type: 'boolean' } } } })
  async readiness(): Promise<{ status: string; postgres: boolean; redis: boolean }> {
    let pg = false;
    let redis = false;
    try { await this.sql`select 1`; pg = true; } catch { /* unhealthy */ }
    try { await this.redis.ping(); redis = true; } catch { /* unhealthy */ }
    return { status: pg && redis ? 'ok' : 'degraded', postgres: pg, redis };
  }

  @Public()
  @Get('metrics')
  async metrics(): Promise<string> {
    return metricsRegistry.metrics();
  }
}
