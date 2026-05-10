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
import { CreateArchiveSchema, UpdateArchiveSchema, type CreateArchiveDto, type UpdateArchiveDto, ArchiveDto, ArchivePageDto } from './dto.js';
import { ArchiveService } from './archive.service.js';

@ApiTags('archive')
@Controller({ path: 'archive', version: '1' })
export class ArchiveController {
  constructor(private readonly svc: ArchiveService) {}

  @Get()
  @Rbac('archive', 'read')
  @ApiOperation({ summary: 'List archive' })
  @ApiOkResponse({ type: ArchivePageDto })
  async list(@Req() req: FastifyRequest, @Query() qRaw: unknown): Promise<ArchivePageDto> {
    const auth = requireAuth(req);
    const q = CursorPageQuerySchema.parse(qRaw);
    return this.svc.list(auth.firmId, { ...(q.cursor !== undefined ? { cursor: q.cursor } : {}), limit: q.limit });
  }

  @Get(':id')
  @Rbac('archive', 'read')
  @ApiOkResponse({ type: ArchiveDto })
  async get(@Req() req: FastifyRequest, @Param('id') id: string): Promise<ArchiveDto> {
    const auth = requireAuth(req);
    return this.svc.get(auth.firmId, id);
  }

  @Post()
  @Rbac('archive', 'create')
  @AuditTrail({ type: 'archive.created', entity: 'archive' })
  @UsePipes(new ZodValidationPipe(CreateArchiveSchema))
  @ApiCreatedResponse({ type: ArchiveDto })
  async create(@Req() req: FastifyRequest, @Body() body: CreateArchiveDto): Promise<ArchiveDto> {
    const auth = requireAuth(req);
    return this.svc.create(auth.firmId, body);
  }

  @Patch(':id')
  @Rbac('archive', 'update')
  @AuditTrail({ type: 'archive.updated', entity: 'archive', entityIdParam: 'id' })
  @UsePipes(new ZodValidationPipe(UpdateArchiveSchema))
  @ApiOkResponse({ type: ArchiveDto })
  async update(@Req() req: FastifyRequest, @Param('id') id: string, @Body() body: UpdateArchiveDto): Promise<ArchiveDto> {
    const auth = requireAuth(req);
    return this.svc.update(auth.firmId, id, body);
  }

  @Delete(':id')
  @Rbac('archive', 'delete')
  @AuditTrail({ type: 'archive.deleted', entity: 'archive', entityIdParam: 'id' })
  async remove(@Req() req: FastifyRequest, @Param('id') id: string): Promise<{ id: string }> {
    const auth = requireAuth(req);
    await this.svc.remove(auth.firmId, id);
    return { id };
  }
}
