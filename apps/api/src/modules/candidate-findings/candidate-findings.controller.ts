// SPDX-License-Identifier: BUSL-1.1
import { Body, Controller, Get, Param, Post, Req, UsePipes } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { AuditTrail } from '../../common/audit-trail.interceptor.js';
import { Rbac } from '../../common/rbac.guard.js';
import { requireAuth } from '../../common/rls.middleware.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import {
  CandidateFindingDto,
  DismissCandidateFindingSchema,
  DismissResultDto,
  PromoteCandidateFindingSchema,
  PromoteResultDto,
  type DismissCandidateFindingDto,
  type PromoteCandidateFindingDto,
} from './dto.js';
import { CandidateFindingsService } from './candidate-findings.service.js';

@ApiTags('candidate-findings')
@Controller({ path: 'engagements/:engagementId/candidate-findings', version: '1' })
export class CandidateFindingsController {
  constructor(private readonly svc: CandidateFindingsService) {}

  @Get()
  @Rbac('findings', 'read')
  @ApiOperation({ summary: 'List candidate findings drafted by the conversational engine' })
  @ApiOkResponse({ type: [CandidateFindingDto] })
  list(
    @Req() req: FastifyRequest,
    @Param('engagementId') engagementId: string,
  ): Promise<CandidateFindingDto[]> {
    return this.svc.list(requireAuth(req).firmId, engagementId);
  }

  @Post(':cfId/promote')
  @Rbac('findings', 'create')
  @AuditTrail({ type: 'finding.promoted', entity: 'finding', entityIdParam: 'cfId' })
  @UsePipes(new ZodValidationPipe(PromoteCandidateFindingSchema))
  @ApiOperation({ summary: 'Promote a candidate to a formal finding (auditor confirmation only)' })
  @ApiCreatedResponse({ type: PromoteResultDto })
  async promote(
    @Req() req: FastifyRequest,
    @Param('engagementId') engagementId: string,
    @Param('cfId') cfId: string,
    @Body() body: PromoteCandidateFindingDto,
  ): Promise<PromoteResultDto> {
    const finding = await this.svc.promote(requireAuth(req).firmId, engagementId, cfId, body);
    return { findingId: finding.id };
  }

  @Post(':cfId/dismiss')
  @Rbac('findings', 'update')
  @AuditTrail({ type: 'finding.dismissed', entity: 'finding', entityIdParam: 'cfId' })
  @UsePipes(new ZodValidationPipe(DismissCandidateFindingSchema))
  @ApiOperation({ summary: 'Dismiss a candidate finding with rationale' })
  @ApiOkResponse({ type: DismissResultDto })
  async dismiss(
    @Req() req: FastifyRequest,
    @Param('cfId') cfId: string,
    @Body() body: DismissCandidateFindingDto,
  ): Promise<DismissResultDto> {
    return this.svc.dismiss(requireAuth(req).firmId, cfId, body.rationale);
  }
}
