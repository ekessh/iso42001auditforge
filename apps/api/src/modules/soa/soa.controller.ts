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
import { CreateSoaSchema, UpdateSoaSchema, type CreateSoaDto, type UpdateSoaDto, SoaDto, SoaPageDto } from './dto.js';
import type { SoaService } from './soa.service.js';

@ApiTags('soa')
@Controller({ path: 'soa', version: '1' })
export class SoaController {
  constructor(private readonly svc: SoaService) {}

  @Get()
  @Rbac('soa', 'read')
  @ApiOperation({ summary: 'List soa' })
  @ApiOkResponse({ type: SoaPageDto })
  async list(@Req() req: FastifyRequest, @Query() qRaw: unknown): Promise<SoaPageDto> {
    const auth = requireAuth(req);
    const q = CursorPageQuerySchema.parse(qRaw);
    return this.svc.list(auth.firmId, { ...(q.cursor !== undefined ? { cursor: q.cursor } : {}), limit: q.limit });
  }

  @Get(':id')
  @Rbac('soa', 'read')
  @ApiOkResponse({ type: SoaDto })
  async get(@Req() req: FastifyRequest, @Param('id') id: string): Promise<SoaDto> {
    const auth = requireAuth(req);
    return this.svc.get(auth.firmId, id);
  }

  @Post()
  @Rbac('soa', 'create')
  @AuditTrail({ type: 'soa.created', entity: 'soa' })
  @UsePipes(new ZodValidationPipe(CreateSoaSchema))
  @ApiCreatedResponse({ type: SoaDto })
  async create(@Req() req: FastifyRequest, @Body() body: CreateSoaDto): Promise<SoaDto> {
    const auth = requireAuth(req);
    return this.svc.create(auth.firmId, body);
  }

  @Patch(':id')
  @Rbac('soa', 'update')
  @AuditTrail({ type: 'soa.updated', entity: 'soa', entityIdParam: 'id' })
  @UsePipes(new ZodValidationPipe(UpdateSoaSchema))
  @ApiOkResponse({ type: SoaDto })
  async update(@Req() req: FastifyRequest, @Param('id') id: string, @Body() body: UpdateSoaDto): Promise<SoaDto> {
    const auth = requireAuth(req);
    return this.svc.update(auth.firmId, id, body);
  }

  @Delete(':id')
  @Rbac('soa', 'delete')
  @AuditTrail({ type: 'soa.deleted', entity: 'soa', entityIdParam: 'id' })
  async remove(@Req() req: FastifyRequest, @Param('id') id: string): Promise<{ id: string }> {
    const auth = requireAuth(req);
    await this.svc.remove(auth.firmId, id);
    return { id };
  }
}
