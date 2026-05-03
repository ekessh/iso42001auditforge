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
import { CreateSamplesSchema, UpdateSamplesSchema, type CreateSamplesDto, type UpdateSamplesDto, SamplesDto, SamplesPageDto } from './dto.js';
import { SamplesService } from './samples.service.js';

@ApiTags('samples')
@Controller({ path: 'samples', version: '1' })
export class SamplesController {
  constructor(private readonly svc: SamplesService) {}

  @Get()
  @Rbac('samples', 'read')
  @ApiOperation({ summary: 'List samples' })
  @ApiOkResponse({ type: SamplesPageDto })
  async list(@Req() req: FastifyRequest, @Query() qRaw: unknown): Promise<SamplesPageDto> {
    const auth = requireAuth(req);
    const q = CursorPageQuerySchema.parse(qRaw);
    return this.svc.list(auth.firmId, { cursor: q.cursor, limit: q.limit });
  }

  @Get(':id')
  @Rbac('samples', 'read')
  @ApiOkResponse({ type: SamplesDto })
  async get(@Req() req: FastifyRequest, @Param('id') id: string): Promise<SamplesDto> {
    const auth = requireAuth(req);
    return this.svc.get(auth.firmId, id);
  }

  @Post()
  @Rbac('samples', 'create')
  @AuditTrail({ type: 'samples.created', entity: 'samples' })
  @UsePipes(new ZodValidationPipe(CreateSamplesSchema))
  @ApiCreatedResponse({ type: SamplesDto })
  async create(@Req() req: FastifyRequest, @Body() body: CreateSamplesDto): Promise<SamplesDto> {
    const auth = requireAuth(req);
    return this.svc.create(auth.firmId, body);
  }

  @Patch(':id')
  @Rbac('samples', 'update')
  @AuditTrail({ type: 'samples.updated', entity: 'samples', entityIdParam: 'id' })
  @UsePipes(new ZodValidationPipe(UpdateSamplesSchema))
  @ApiOkResponse({ type: SamplesDto })
  async update(@Req() req: FastifyRequest, @Param('id') id: string, @Body() body: UpdateSamplesDto): Promise<SamplesDto> {
    const auth = requireAuth(req);
    return this.svc.update(auth.firmId, id, body);
  }

  @Delete(':id')
  @Rbac('samples', 'delete')
  @AuditTrail({ type: 'samples.deleted', entity: 'samples', entityIdParam: 'id' })
  async remove(@Req() req: FastifyRequest, @Param('id') id: string): Promise<{ id: string }> {
    const auth = requireAuth(req);
    await this.svc.remove(auth.firmId, id);
    return { id };
  }
}
