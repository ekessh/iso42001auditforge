// SPDX-License-Identifier: BUSL-1.1
import { Controller, Get, Param, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { Rbac } from '../../common/rbac.guard.js';
import { requireAuth } from '../../common/rls.middleware.js';
import { ReadinessDto } from './dto.js';
import { ReadinessService } from './readiness.service.js';

@ApiTags('readiness')
@Controller({ path: 'engagements/:engagementId/dashboard/readiness', version: '1' })
export class ReadinessController {
  constructor(private readonly svc: ReadinessService) {}

  @Get()
  @Rbac('engagements', 'read')
  @ApiOperation({ summary: 'Readiness Mode dashboard for the engagement' })
  @ApiOkResponse({ type: ReadinessDto })
  get(
    @Req() req: FastifyRequest,
    @Param('engagementId') engagementId: string,
  ): Promise<ReadinessDto> {
    return this.svc.build(requireAuth(req).firmId, engagementId);
  }
}
