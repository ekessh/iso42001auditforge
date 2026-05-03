// SPDX-License-Identifier: BUSL-1.1
import { Body, Controller, Get, Param, Patch, Post, Query, Req, UsePipes } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AuditTrail } from '../../common/audit-trail.interceptor.js';
import { CursorPageQuerySchema } from '../../common/pagination.js';
import { Rbac } from '../../common/rbac.guard.js';
import { requireAuth } from '../../common/rls.middleware.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import {
  CreateFindingSchema,
  FindingDto,
  FindingPageDto,
  FindingStatus,
  UpdateFindingSchema,
  type CreateFindingDto,
  type UpdateFindingDto,
} from './dto.js';
import { FindingsService } from './findings.service.js';

const TransitionSchema = z.object({ to: FindingStatus });

@ApiTags('findings')
@Controller({ path: 'findings', version: '1' })
export class FindingsController {
  constructor(private readonly svc: FindingsService) {}

  @Get()
  @Rbac('findings', 'read')
  @ApiOkResponse({ type: FindingPageDto })
  list(@Req() req: FastifyRequest, @Query() qRaw: unknown, @Query('engagementId') engagementId?: string): Promise<FindingPageDto> {
    const auth = requireAuth(req);
    const q = CursorPageQuerySchema.parse(qRaw);
    return this.svc.list(auth.firmId, { ...(engagementId ? { engagementId } : {}), cursor: q.cursor, limit: q.limit });
  }

  @Get(':id')
  @Rbac('findings', 'read')
  @ApiOkResponse({ type: FindingDto })
  get(@Req() req: FastifyRequest, @Param('id') id: string): Promise<FindingDto> {
    return this.svc.get(requireAuth(req).firmId, id);
  }

  @Post()
  @Rbac('findings', 'create')
  @AuditTrail({ type: 'finding.raised', entity: 'finding' })
  @UsePipes(new ZodValidationPipe(CreateFindingSchema))
  @ApiCreatedResponse({ type: FindingDto })
  create(@Req() req: FastifyRequest, @Body() body: CreateFindingDto): Promise<FindingDto> {
    return this.svc.create(requireAuth(req).firmId, body);
  }

  @Patch(':id')
  @Rbac('findings', 'update')
  @AuditTrail({ type: 'finding.updated', entity: 'finding', entityIdParam: 'id' })
  @UsePipes(new ZodValidationPipe(UpdateFindingSchema))
  @ApiOkResponse({ type: FindingDto })
  update(@Req() req: FastifyRequest, @Param('id') id: string, @Body() body: UpdateFindingDto): Promise<FindingDto> {
    return this.svc.update(requireAuth(req).firmId, id, body);
  }

  @Post(':id/transition')
  @Rbac('findings', 'update')
  @AuditTrail({ type: 'finding.transitioned', entity: 'finding', entityIdParam: 'id' })
  @UsePipes(new ZodValidationPipe(TransitionSchema))
  @ApiOkResponse({ type: FindingDto })
  transition(@Req() req: FastifyRequest, @Param('id') id: string, @Body() body: { to: FindingDto['status'] }): Promise<FindingDto> {
    return this.svc.transition(requireAuth(req).firmId, id, body.to);
  }
}
