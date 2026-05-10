// SPDX-License-Identifier: BUSL-1.1
import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseInterceptors, UsePipes } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { AuditTrail } from '../../common/audit-trail.interceptor.js';
import { CursorPageQuerySchema } from '../../common/pagination.js';
import { Rbac } from '../../common/rbac.guard.js';
import { requireAuth } from '../../common/rls.middleware.js';
import { RequiresSignedAction, SignedActionInterceptor } from '../../common/signed-action.interceptor.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import {
  CreateReportSchema,
  ReportDto,
  ReportPageDto,
  SignReportSchema,
  UpdateReportSchema,
  type CreateReportDto,
  type SignReportDto,
  type UpdateReportDto,
} from './dto.js';
import { ReportsService } from './reports.service.js';

@ApiTags('reports')
@Controller({ path: 'reports', version: '1' })
@UseInterceptors(SignedActionInterceptor)
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  @Get()
  @Rbac('reports', 'read')
  @ApiOkResponse({ type: ReportPageDto })
  list(@Req() req: FastifyRequest, @Query() qRaw: unknown, @Query('engagementId') engagementId?: string): Promise<ReportPageDto> {
    const auth = requireAuth(req);
    const q = CursorPageQuerySchema.parse(qRaw);
    return this.svc.list(auth.firmId, { ...(engagementId ? { engagementId } : {}), ...(q.cursor !== undefined ? { cursor: q.cursor } : {}), limit: q.limit });
  }

  @Get(':id')
  @Rbac('reports', 'read')
  @ApiOkResponse({ type: ReportDto })
  get(@Req() req: FastifyRequest, @Param('id') id: string): Promise<ReportDto> {
    return this.svc.get(requireAuth(req).firmId, id);
  }

  @Post()
  @Rbac('reports', 'create')
  @AuditTrail({ type: 'report.created', entity: 'report' })
  @UsePipes(new ZodValidationPipe(CreateReportSchema))
  @ApiCreatedResponse({ type: ReportDto })
  create(@Req() req: FastifyRequest, @Body() body: CreateReportDto): Promise<ReportDto> {
    return this.svc.create(requireAuth(req).firmId, body);
  }

  @Patch(':id')
  @Rbac('reports', 'update')
  @AuditTrail({ type: 'report.updated', entity: 'report', entityIdParam: 'id' })
  @UsePipes(new ZodValidationPipe(UpdateReportSchema))
  @ApiOkResponse({ type: ReportDto })
  update(@Req() req: FastifyRequest, @Param('id') id: string, @Body() body: UpdateReportDto): Promise<ReportDto> {
    return this.svc.update(requireAuth(req).firmId, id, body);
  }

  @Post(':id/render')
  @Rbac('reports', 'update')
  @AuditTrail({ type: 'report.render-queued', entity: 'report', entityIdParam: 'id' })
  @ApiOperation({ summary: 'Queue PDF rendering' })
  render(@Req() req: FastifyRequest, @Param('id') id: string): Promise<{ jobId: string }> {
    return this.svc.render(requireAuth(req).firmId, id);
  }

  @Post(':id/sign')
  @Rbac('reports', 'sign')
  @RequiresSignedAction()
  @AuditTrail({ type: 'report.signed', entity: 'report', entityIdParam: 'id' })
  @UsePipes(new ZodValidationPipe(SignReportSchema))
  @ApiOperation({ summary: 'Sign and issue report (WebAuthn-attested)' })
  @ApiOkResponse({ type: ReportDto })
  sign(@Req() req: FastifyRequest, @Param('id') id: string, @Body() body: SignReportDto): Promise<ReportDto> {
    const auth = requireAuth(req);
    return this.svc.sign(auth.firmId, id, auth.auditorId, body);
  }
}
