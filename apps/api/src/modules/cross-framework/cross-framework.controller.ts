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
import { CreateCrossFrameworkSchema, UpdateCrossFrameworkSchema, type CreateCrossFrameworkDto, type UpdateCrossFrameworkDto, CrossFrameworkDto, CrossFrameworkPageDto } from './dto.js';
import type { CrossFrameworkService } from './cross-framework.service.js';

@ApiTags('cross-framework')
@Controller({ path: 'cross-framework', version: '1' })
export class CrossFrameworkController {
  constructor(private readonly svc: CrossFrameworkService) {}

  @Get()
  @Rbac('cross-framework', 'read')
  @ApiOperation({ summary: 'List cross-framework' })
  @ApiOkResponse({ type: CrossFrameworkPageDto })
  async list(@Req() req: FastifyRequest, @Query() qRaw: unknown): Promise<CrossFrameworkPageDto> {
    const auth = requireAuth(req);
    const q = CursorPageQuerySchema.parse(qRaw);
    return this.svc.list(auth.firmId, { ...(q.cursor !== undefined ? { cursor: q.cursor } : {}), limit: q.limit });
  }

  @Get(':id')
  @Rbac('cross-framework', 'read')
  @ApiOkResponse({ type: CrossFrameworkDto })
  async get(@Req() req: FastifyRequest, @Param('id') id: string): Promise<CrossFrameworkDto> {
    const auth = requireAuth(req);
    return this.svc.get(auth.firmId, id);
  }

  @Post()
  @Rbac('cross-framework', 'create')
  @AuditTrail({ type: 'cross-framework.created', entity: 'cross-framework' })
  @UsePipes(new ZodValidationPipe(CreateCrossFrameworkSchema))
  @ApiCreatedResponse({ type: CrossFrameworkDto })
  async create(@Req() req: FastifyRequest, @Body() body: CreateCrossFrameworkDto): Promise<CrossFrameworkDto> {
    const auth = requireAuth(req);
    return this.svc.create(auth.firmId, body);
  }

  @Patch(':id')
  @Rbac('cross-framework', 'update')
  @AuditTrail({ type: 'cross-framework.updated', entity: 'cross-framework', entityIdParam: 'id' })
  @UsePipes(new ZodValidationPipe(UpdateCrossFrameworkSchema))
  @ApiOkResponse({ type: CrossFrameworkDto })
  async update(@Req() req: FastifyRequest, @Param('id') id: string, @Body() body: UpdateCrossFrameworkDto): Promise<CrossFrameworkDto> {
    const auth = requireAuth(req);
    return this.svc.update(auth.firmId, id, body);
  }

  @Delete(':id')
  @Rbac('cross-framework', 'delete')
  @AuditTrail({ type: 'cross-framework.deleted', entity: 'cross-framework', entityIdParam: 'id' })
  async remove(@Req() req: FastifyRequest, @Param('id') id: string): Promise<{ id: string }> {
    const auth = requireAuth(req);
    await this.svc.remove(auth.firmId, id);
    return { id };
  }
}
