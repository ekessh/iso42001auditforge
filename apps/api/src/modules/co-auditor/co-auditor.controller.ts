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
import { CreateCoAuditorSchema, UpdateCoAuditorSchema, type CreateCoAuditorDto, type UpdateCoAuditorDto, CoAuditorDto, CoAuditorPageDto } from './dto.js';
import type { CoAuditorService } from './co-auditor.service.js';

@ApiTags('co-auditor')
@Controller({ path: 'co-auditor', version: '1' })
export class CoAuditorController {
  constructor(private readonly svc: CoAuditorService) {}

  @Get()
  @Rbac('co-auditor', 'read')
  @ApiOperation({ summary: 'List co-auditor' })
  @ApiOkResponse({ type: CoAuditorPageDto })
  async list(@Req() req: FastifyRequest, @Query() qRaw: unknown): Promise<CoAuditorPageDto> {
    const auth = requireAuth(req);
    const q = CursorPageQuerySchema.parse(qRaw);
    return this.svc.list(auth.firmId, { ...(q.cursor !== undefined ? { cursor: q.cursor } : {}), limit: q.limit });
  }

  @Get(':id')
  @Rbac('co-auditor', 'read')
  @ApiOkResponse({ type: CoAuditorDto })
  async get(@Req() req: FastifyRequest, @Param('id') id: string): Promise<CoAuditorDto> {
    const auth = requireAuth(req);
    return this.svc.get(auth.firmId, id);
  }

  @Post()
  @Rbac('co-auditor', 'create')
  @AuditTrail({ type: 'co-auditor.created', entity: 'co-auditor' })
  @UsePipes(new ZodValidationPipe(CreateCoAuditorSchema))
  @ApiCreatedResponse({ type: CoAuditorDto })
  async create(@Req() req: FastifyRequest, @Body() body: CreateCoAuditorDto): Promise<CoAuditorDto> {
    const auth = requireAuth(req);
    return this.svc.create(auth.firmId, body);
  }

  @Patch(':id')
  @Rbac('co-auditor', 'update')
  @AuditTrail({ type: 'co-auditor.updated', entity: 'co-auditor', entityIdParam: 'id' })
  @UsePipes(new ZodValidationPipe(UpdateCoAuditorSchema))
  @ApiOkResponse({ type: CoAuditorDto })
  async update(@Req() req: FastifyRequest, @Param('id') id: string, @Body() body: UpdateCoAuditorDto): Promise<CoAuditorDto> {
    const auth = requireAuth(req);
    return this.svc.update(auth.firmId, id, body);
  }

  @Delete(':id')
  @Rbac('co-auditor', 'delete')
  @AuditTrail({ type: 'co-auditor.deleted', entity: 'co-auditor', entityIdParam: 'id' })
  async remove(@Req() req: FastifyRequest, @Param('id') id: string): Promise<{ id: string }> {
    const auth = requireAuth(req);
    await this.svc.remove(auth.firmId, id);
    return { id };
  }
}
