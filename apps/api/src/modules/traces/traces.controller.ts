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
import { CreateTracesSchema, UpdateTracesSchema, type CreateTracesDto, type UpdateTracesDto, TracesDto, TracesPageDto } from './dto.js';
import { TracesService } from './traces.service.js';

@ApiTags('traces')
@Controller({ path: 'traces', version: '1' })
export class TracesController {
  constructor(private readonly svc: TracesService) {}

  @Get()
  @Rbac('traces', 'read')
  @ApiOperation({ summary: 'List traces' })
  @ApiOkResponse({ type: TracesPageDto })
  async list(@Req() req: FastifyRequest, @Query() qRaw: unknown): Promise<TracesPageDto> {
    const auth = requireAuth(req);
    const q = CursorPageQuerySchema.parse(qRaw);
    return this.svc.list(auth.firmId, { cursor: q.cursor, limit: q.limit });
  }

  @Get(':id')
  @Rbac('traces', 'read')
  @ApiOkResponse({ type: TracesDto })
  async get(@Req() req: FastifyRequest, @Param('id') id: string): Promise<TracesDto> {
    const auth = requireAuth(req);
    return this.svc.get(auth.firmId, id);
  }

  @Post()
  @Rbac('traces', 'create')
  @AuditTrail({ type: 'traces.created', entity: 'traces' })
  @UsePipes(new ZodValidationPipe(CreateTracesSchema))
  @ApiCreatedResponse({ type: TracesDto })
  async create(@Req() req: FastifyRequest, @Body() body: CreateTracesDto): Promise<TracesDto> {
    const auth = requireAuth(req);
    return this.svc.create(auth.firmId, body);
  }

  @Patch(':id')
  @Rbac('traces', 'update')
  @AuditTrail({ type: 'traces.updated', entity: 'traces', entityIdParam: 'id' })
  @UsePipes(new ZodValidationPipe(UpdateTracesSchema))
  @ApiOkResponse({ type: TracesDto })
  async update(@Req() req: FastifyRequest, @Param('id') id: string, @Body() body: UpdateTracesDto): Promise<TracesDto> {
    const auth = requireAuth(req);
    return this.svc.update(auth.firmId, id, body);
  }

  @Delete(':id')
  @Rbac('traces', 'delete')
  @AuditTrail({ type: 'traces.deleted', entity: 'traces', entityIdParam: 'id' })
  async remove(@Req() req: FastifyRequest, @Param('id') id: string): Promise<{ id: string }> {
    const auth = requireAuth(req);
    await this.svc.remove(auth.firmId, id);
    return { id };
  }
}
