// SPDX-License-Identifier: BUSL-1.1
import { Body, Controller, Get, Param, Patch, Post, Query, Req, UsePipes } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { AuditTrail } from '../../common/audit-trail.interceptor.js';
import { CursorPageQuerySchema } from '../../common/pagination.js';
import { Rbac } from '../../common/rbac.guard.js';
import { requireAuth } from '../../common/rls.middleware.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import {
  CreateEngagementSchema,
  EngagementDto,
  EngagementPageDto,
  TransitionEngagementSchema,
  UpdateEngagementSchema,
  type CreateEngagementDto,
  type TransitionEngagementDto,
  type UpdateEngagementDto,
} from './dto.js';
import { EngagementsService } from './engagements.service.js';

@ApiTags('engagements')
@Controller({ path: 'engagements', version: '1' })
export class EngagementsController {
  constructor(private readonly svc: EngagementsService) {}

  @Get()
  @Rbac('engagements', 'read')
  @ApiOperation({ summary: 'List engagements (cursor paginated)' })
  @ApiOkResponse({ type: EngagementPageDto })
  list(@Req() req: FastifyRequest, @Query() qRaw: unknown): Promise<EngagementPageDto> {
    const auth = requireAuth(req);
    const q = CursorPageQuerySchema.parse(qRaw);
    return this.svc.list(auth.firmId, { cursor: q.cursor, limit: q.limit });
  }

  @Get(':id')
  @Rbac('engagements', 'read')
  @ApiOkResponse({ type: EngagementDto })
  get(@Req() req: FastifyRequest, @Param('id') id: string): Promise<EngagementDto> {
    return this.svc.get(requireAuth(req).firmId, id);
  }

  @Post()
  @Rbac('engagements', 'create')
  @AuditTrail({ type: 'engagement.created', entity: 'engagement' })
  @UsePipes(new ZodValidationPipe(CreateEngagementSchema))
  @ApiCreatedResponse({ type: EngagementDto })
  create(@Req() req: FastifyRequest, @Body() body: CreateEngagementDto): Promise<EngagementDto> {
    return this.svc.create(requireAuth(req).firmId, body);
  }

  @Patch(':id')
  @Rbac('engagements', 'update')
  @AuditTrail({ type: 'engagement.updated', entity: 'engagement', entityIdParam: 'id' })
  @UsePipes(new ZodValidationPipe(UpdateEngagementSchema))
  @ApiOkResponse({ type: EngagementDto })
  update(@Req() req: FastifyRequest, @Param('id') id: string, @Body() body: UpdateEngagementDto): Promise<EngagementDto> {
    return this.svc.update(requireAuth(req).firmId, id, body);
  }

  @Post(':id/transition')
  @Rbac('engagements', 'update')
  @AuditTrail({ type: 'engagement.transitioned', entity: 'engagement', entityIdParam: 'id' })
  @UsePipes(new ZodValidationPipe(TransitionEngagementSchema))
  @ApiOperation({ summary: 'Transition engagement lifecycle state' })
  @ApiOkResponse({ type: EngagementDto })
  transition(@Req() req: FastifyRequest, @Param('id') id: string, @Body() body: TransitionEngagementDto): Promise<EngagementDto> {
    return this.svc.transition(requireAuth(req).firmId, id, body);
  }
}
