// SPDX-License-Identifier: BUSL-1.1
import { Controller, Get, Param, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { Rbac } from '../../common/rbac.guard.js';
import { requireAuth } from '../../common/rls.middleware.js';
import { AuditDashboardDto } from './dto.js';
import { AuditDashboardService } from './audit-dashboard.service.js';

@ApiTags('audit-dashboard')
@Controller({ path: 'engagements/:engagementId/dashboard/audit', version: '1' })
export class AuditDashboardController {
  constructor(private readonly svc: AuditDashboardService) {}

  @Get()
  @Rbac('engagements', 'read')
  @ApiOperation({ summary: 'Audit Mode dashboard for the engagement' })
  @ApiOkResponse({ type: AuditDashboardDto })
  get(
    @Req() req: FastifyRequest,
    @Param('engagementId') engagementId: string,
  ): Promise<AuditDashboardDto> {
    return this.svc.build(requireAuth(req).firmId, engagementId);
  }
}
