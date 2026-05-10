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
import { CreateRisksSchema, UpdateRisksSchema, type CreateRisksDto, type UpdateRisksDto, RisksDto, RisksPageDto } from './dto.js';
import { RisksService } from './risks.service.js';

@ApiTags('risks')
@Controller({ path: 'risks', version: '1' })
export class RisksController {
  constructor(private readonly svc: RisksService) {}

  @Get()
  @Rbac('risks', 'read')
  @ApiOperation({ summary: 'List risks' })
  @ApiOkResponse({ type: RisksPageDto })
  async list(@Req() req: FastifyRequest, @Query() qRaw: unknown): Promise<RisksPageDto> {
    const auth = requireAuth(req);
    const q = CursorPageQuerySchema.parse(qRaw);
    return this.svc.list(auth.firmId, { ...(q.cursor !== undefined ? { cursor: q.cursor } : {}), limit: q.limit });
  }

  @Get(':id')
  @Rbac('risks', 'read')
  @ApiOkResponse({ type: RisksDto })
  async get(@Req() req: FastifyRequest, @Param('id') id: string): Promise<RisksDto> {
    const auth = requireAuth(req);
    return this.svc.get(auth.firmId, id);
  }

  @Post()
  @Rbac('risks', 'create')
  @AuditTrail({ type: 'risks.created', entity: 'risks' })
  @UsePipes(new ZodValidationPipe(CreateRisksSchema))
  @ApiCreatedResponse({ type: RisksDto })
  async create(@Req() req: FastifyRequest, @Body() body: CreateRisksDto): Promise<RisksDto> {
    const auth = requireAuth(req);
    return this.svc.create(auth.firmId, body);
  }

  @Patch(':id')
  @Rbac('risks', 'update')
  @AuditTrail({ type: 'risks.updated', entity: 'risks', entityIdParam: 'id' })
  @UsePipes(new ZodValidationPipe(UpdateRisksSchema))
  @ApiOkResponse({ type: RisksDto })
  async update(@Req() req: FastifyRequest, @Param('id') id: string, @Body() body: UpdateRisksDto): Promise<RisksDto> {
    const auth = requireAuth(req);
    return this.svc.update(auth.firmId, id, body);
  }

  @Delete(':id')
  @Rbac('risks', 'delete')
  @AuditTrail({ type: 'risks.deleted', entity: 'risks', entityIdParam: 'id' })
  async remove(@Req() req: FastifyRequest, @Param('id') id: string): Promise<{ id: string }> {
    const auth = requireAuth(req);
    await this.svc.remove(auth.firmId, id);
    return { id };
  }
}
