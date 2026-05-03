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
import { CreateCapaSchema, UpdateCapaSchema, type CreateCapaDto, type UpdateCapaDto, CapaDto, CapaPageDto } from './dto.js';
import { CapaService } from './capa.service.js';

@ApiTags('capa')
@Controller({ path: 'capa', version: '1' })
export class CapaController {
  constructor(private readonly svc: CapaService) {}

  @Get()
  @Rbac('capa', 'read')
  @ApiOperation({ summary: 'List capa' })
  @ApiOkResponse({ type: CapaPageDto })
  async list(@Req() req: FastifyRequest, @Query() qRaw: unknown): Promise<CapaPageDto> {
    const auth = requireAuth(req);
    const q = CursorPageQuerySchema.parse(qRaw);
    return this.svc.list(auth.firmId, { cursor: q.cursor, limit: q.limit });
  }

  @Get(':id')
  @Rbac('capa', 'read')
  @ApiOkResponse({ type: CapaDto })
  async get(@Req() req: FastifyRequest, @Param('id') id: string): Promise<CapaDto> {
    const auth = requireAuth(req);
    return this.svc.get(auth.firmId, id);
  }

  @Post()
  @Rbac('capa', 'create')
  @AuditTrail({ type: 'capa.created', entity: 'capa' })
  @UsePipes(new ZodValidationPipe(CreateCapaSchema))
  @ApiCreatedResponse({ type: CapaDto })
  async create(@Req() req: FastifyRequest, @Body() body: CreateCapaDto): Promise<CapaDto> {
    const auth = requireAuth(req);
    return this.svc.create(auth.firmId, body);
  }

  @Patch(':id')
  @Rbac('capa', 'update')
  @AuditTrail({ type: 'capa.updated', entity: 'capa', entityIdParam: 'id' })
  @UsePipes(new ZodValidationPipe(UpdateCapaSchema))
  @ApiOkResponse({ type: CapaDto })
  async update(@Req() req: FastifyRequest, @Param('id') id: string, @Body() body: UpdateCapaDto): Promise<CapaDto> {
    const auth = requireAuth(req);
    return this.svc.update(auth.firmId, id, body);
  }

  @Delete(':id')
  @Rbac('capa', 'delete')
  @AuditTrail({ type: 'capa.deleted', entity: 'capa', entityIdParam: 'id' })
  async remove(@Req() req: FastifyRequest, @Param('id') id: string): Promise<{ id: string }> {
    const auth = requireAuth(req);
    await this.svc.remove(auth.firmId, id);
    return { id };
  }
}
