// SPDX-License-Identifier: BUSL-1.1
import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { Rbac } from '../../common/rbac.guard.js';
import { requireAuth } from '../../common/rls.middleware.js';
import {
  AggregateRequestSchema,
  AggregateResultDto,
  PatternPageDto,
  PatternQuerySchema,
} from './dto.js';
import { CrossEngagementMemoryService } from './cross-engagement-memory.service.js';

@ApiTags('cross-engagement-memory')
@Controller({ path: 'cross-engagement-memory', version: '1' })
export class CrossEngagementMemoryController {
  constructor(private readonly svc: CrossEngagementMemoryService) {}

  @Get()
  @Rbac('catalogue', 'read')
  @ApiOperation({
    summary:
      'Query anonymized per-firm cross-engagement patterns. Read-only; lead-auditor consumption surface.',
  })
  @ApiOkResponse({ type: PatternPageDto })
  async list(
    @Req() req: FastifyRequest,
    @Query() qRaw: unknown,
  ): Promise<PatternPageDto> {
    const auth = requireAuth(req);
    const q = PatternQuerySchema.parse(qRaw);
    const scope = q.scope ? safeParseScope(q.scope) : undefined;
    return this.svc.list({
      firmId: auth.firmId,
      auditorId: auth.auditorId,
      ...(q.kind ? { kind: q.kind } : {}),
      ...(scope ? { scope } : {}),
      limit: q.limit,
    });
  }

  @Post('aggregate/:engagementId')
  @Rbac('catalogue', 'import')
  @ApiOperation({
    summary:
      'Trigger pattern aggregation for a closed engagement. Anonymizer enforced; emits cross-engagement-memory.aggregated.',
  })
  @ApiOkResponse({ type: AggregateResultDto })
  async aggregate(
    @Req() req: FastifyRequest,
    @Param('engagementId') engagementId: string,
    @Body() body: unknown,
  ): Promise<AggregateResultDto> {
    const auth = requireAuth(req);
    const parsed = AggregateRequestSchema.parse({ ...((body ?? {}) as object), engagementId });
    return this.svc.aggregate({
      firmId: auth.firmId,
      auditorId: auth.auditorId,
      request: parsed,
    });
  }
}

function safeParseScope(raw: string): Record<string, string> | undefined {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string') out[k] = v;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  } catch {
    return undefined;
  }
}
