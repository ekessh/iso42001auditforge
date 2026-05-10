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
import { CreateTenancySchema, UpdateTenancySchema, type CreateTenancyDto, type UpdateTenancyDto, TenancyDto, TenancyPageDto } from './dto.js';
import { TenancyService } from './tenancy.service.js';

@ApiTags('tenancy')
@Controller({ path: 'tenancy', version: '1' })
export class TenancyController {
  constructor(private readonly svc: TenancyService) {}

  @Get()
  @Rbac('tenancy', 'read')
  @ApiOperation({ summary: 'List tenancy' })
  @ApiOkResponse({ type: TenancyPageDto })
  async list(@Req() req: FastifyRequest, @Query() qRaw: unknown): Promise<TenancyPageDto> {
    const auth = requireAuth(req);
    const q = CursorPageQuerySchema.parse(qRaw);
    return this.svc.list(auth.firmId, { ...(q.cursor !== undefined ? { cursor: q.cursor } : {}), limit: q.limit });
  }

  @Get(':id')
  @Rbac('tenancy', 'read')
  @ApiOkResponse({ type: TenancyDto })
  async get(@Req() req: FastifyRequest, @Param('id') id: string): Promise<TenancyDto> {
    const auth = requireAuth(req);
    return this.svc.get(auth.firmId, id);
  }

  @Post()
  @Rbac('tenancy', 'create')
  @AuditTrail({ type: 'tenancy.created', entity: 'tenancy' })
  @UsePipes(new ZodValidationPipe(CreateTenancySchema))
  @ApiCreatedResponse({ type: TenancyDto })
  async create(@Req() req: FastifyRequest, @Body() body: CreateTenancyDto): Promise<TenancyDto> {
    const auth = requireAuth(req);
    return this.svc.create(auth.firmId, body);
  }

  @Patch(':id')
  @Rbac('tenancy', 'update')
  @AuditTrail({ type: 'tenancy.updated', entity: 'tenancy', entityIdParam: 'id' })
  @UsePipes(new ZodValidationPipe(UpdateTenancySchema))
  @ApiOkResponse({ type: TenancyDto })
  async update(@Req() req: FastifyRequest, @Param('id') id: string, @Body() body: UpdateTenancyDto): Promise<TenancyDto> {
    const auth = requireAuth(req);
    return this.svc.update(auth.firmId, id, body);
  }

  @Delete(':id')
  @Rbac('tenancy', 'delete')
  @AuditTrail({ type: 'tenancy.deleted', entity: 'tenancy', entityIdParam: 'id' })
  async remove(@Req() req: FastifyRequest, @Param('id') id: string): Promise<{ id: string }> {
    const auth = requireAuth(req);
    await this.svc.remove(auth.firmId, id);
    return { id };
  }
}
