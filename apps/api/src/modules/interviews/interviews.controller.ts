// SPDX-License-Identifier: BUSL-1.1
import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UsePipes, Req,
} from '@nestjs/common';
import { ApiTags, ApiOkResponse, ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { Rbac } from '../../common/rbac.guard.js';
import { AuditTrail } from '../../common/audit-trail.interceptor.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { CursorPageQuerySchema } from '../../common/pagination.js';
import { requireAuth } from '../../common/rls.middleware.js';
import { CreateInterviewsSchema, UpdateInterviewsSchema, type CreateInterviewsDto, type UpdateInterviewsDto, InterviewsDto, InterviewsPageDto } from './dto.js';
import { InterviewsService } from './interviews.service.js';

@ApiTags('interviews')
@Controller({ path: 'interviews', version: '1' })
export class InterviewsController {
  constructor(private readonly svc: InterviewsService) {}

  @Get()
  @Rbac('interviews', 'read')
  @ApiOperation({ summary: 'List interviews' })
  @ApiOkResponse({ type: InterviewsPageDto })
  async list(@Req() req: FastifyRequest, @Query() qRaw: unknown): Promise<InterviewsPageDto> {
    const auth = requireAuth(req);
    const q = CursorPageQuerySchema.parse(qRaw);
    return this.svc.list(auth.firmId, { cursor: q.cursor, limit: q.limit });
  }

  @Get(':id')
  @Rbac('interviews', 'read')
  @ApiOkResponse({ type: InterviewsDto })
  async get(@Req() req: FastifyRequest, @Param('id') id: string): Promise<InterviewsDto> {
    const auth = requireAuth(req);
    return this.svc.get(auth.firmId, id);
  }

  @Post()
  @Rbac('interviews', 'create')
  @AuditTrail({ type: 'interviews.created', entity: 'interviews' })
  @UsePipes(new ZodValidationPipe(CreateInterviewsSchema))
  @ApiCreatedResponse({ type: InterviewsDto })
  async create(@Req() req: FastifyRequest, @Body() body: CreateInterviewsDto): Promise<InterviewsDto> {
    const auth = requireAuth(req);
    return this.svc.create(auth.firmId, body);
  }

  @Patch(':id')
  @Rbac('interviews', 'update')
  @AuditTrail({ type: 'interviews.updated', entity: 'interviews', entityIdParam: 'id' })
  @UsePipes(new ZodValidationPipe(UpdateInterviewsSchema))
  @ApiOkResponse({ type: InterviewsDto })
  async update(@Req() req: FastifyRequest, @Param('id') id: string, @Body() body: UpdateInterviewsDto): Promise<InterviewsDto> {
    const auth = requireAuth(req);
    return this.svc.update(auth.firmId, id, body);
  }

  @Delete(':id')
  @Rbac('interviews', 'delete')
  @AuditTrail({ type: 'interviews.deleted', entity: 'interviews', entityIdParam: 'id' })
  async remove(@Req() req: FastifyRequest, @Param('id') id: string): Promise<{ id: string }> {
    const auth = requireAuth(req);
    await this.svc.remove(auth.firmId, id);
    return { id };
  }
}
