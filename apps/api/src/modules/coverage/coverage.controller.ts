// SPDX-License-Identifier: BUSL-1.1
import { Controller, Get, Param, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { Rbac } from '../../common/rbac.guard.js';
import { requireAuth } from '../../common/rls.middleware.js';
import { CoverageAreaDto } from './dto.js';
import { CoverageService } from './coverage.service.js';

@ApiTags('coverage')
@Controller({ path: 'engagements/:engagementId/coverage', version: '1' })
export class CoverageController {
  constructor(private readonly svc: CoverageService) {}

  @Get()
  @Rbac('engagements', 'read')
  @ApiOperation({ summary: 'Compute clause-by-clause coverage for the engagement' })
  @ApiOkResponse({ type: CoverageAreaDto })
  get(
    @Req() req: FastifyRequest,
    @Param('engagementId') engagementId: string,
  ): Promise<CoverageAreaDto> {
    return this.svc.compute(requireAuth(req).firmId, engagementId);
  }
}
