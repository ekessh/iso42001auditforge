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
import { CreateAuditPlansSchema, UpdateAuditPlansSchema, type CreateAuditPlansDto, type UpdateAuditPlansDto, AuditPlansDto, AuditPlansPageDto } from './dto.js';
import type { AuditPlansService } from './audit-plans.service.js';

@ApiTags('audit-plans')
@Controller({ path: 'audit-plans', version: '1' })
export class AuditPlansController {
  constructor(private readonly svc: AuditPlansService) {}

  @Get()
  @Rbac('audit-plans', 'read')
  @ApiOperation({ summary: 'List audit-plans' })
  @ApiOkResponse({ type: AuditPlansPageDto })
  async list(@Req() req: FastifyRequest, @Query() qRaw: unknown): Promise<AuditPlansPageDto> {
    const auth = requireAuth(req);
    const q = CursorPageQuerySchema.parse(qRaw);
    return this.svc.list(auth.firmId, { ...(q.cursor !== undefined ? { cursor: q.cursor } : {}), limit: q.limit });
  }

  @Get(':id')
  @Rbac('audit-plans', 'read')
  @ApiOkResponse({ type: AuditPlansDto })
  async get(@Req() req: FastifyRequest, @Param('id') id: string): Promise<AuditPlansDto> {
    const auth = requireAuth(req);
    return this.svc.get(auth.firmId, id);
  }

  @Post()
  @Rbac('audit-plans', 'create')
  @AuditTrail({ type: 'audit-plans.created', entity: 'audit-plans' })
  @UsePipes(new ZodValidationPipe(CreateAuditPlansSchema))
  @ApiCreatedResponse({ type: AuditPlansDto })
  async create(@Req() req: FastifyRequest, @Body() body: CreateAuditPlansDto): Promise<AuditPlansDto> {
    const auth = requireAuth(req);
    return this.svc.create(auth.firmId, body);
  }

  @Patch(':id')
  @Rbac('audit-plans', 'update')
  @AuditTrail({ type: 'audit-plans.updated', entity: 'audit-plans', entityIdParam: 'id' })
  @UsePipes(new ZodValidationPipe(UpdateAuditPlansSchema))
  @ApiOkResponse({ type: AuditPlansDto })
  async update(@Req() req: FastifyRequest, @Param('id') id: string, @Body() body: UpdateAuditPlansDto): Promise<AuditPlansDto> {
    const auth = requireAuth(req);
    return this.svc.update(auth.firmId, id, body);
  }

  @Delete(':id')
  @Rbac('audit-plans', 'delete')
  @AuditTrail({ type: 'audit-plans.deleted', entity: 'audit-plans', entityIdParam: 'id' })
  async remove(@Req() req: FastifyRequest, @Param('id') id: string): Promise<{ id: string }> {
    const auth = requireAuth(req);
    await this.svc.remove(auth.firmId, id);
    return { id };
  }
}
