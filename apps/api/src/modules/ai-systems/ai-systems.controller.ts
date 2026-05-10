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
import { CreateAiSystemsSchema, UpdateAiSystemsSchema, type CreateAiSystemsDto, type UpdateAiSystemsDto, AiSystemsDto, AiSystemsPageDto } from './dto.js';
import type { AiSystemsService } from './ai-systems.service.js';

@ApiTags('ai-systems')
@Controller({ path: 'ai-systems', version: '1' })
export class AiSystemsController {
  constructor(private readonly svc: AiSystemsService) {}

  @Get()
  @Rbac('ai-systems', 'read')
  @ApiOperation({ summary: 'List ai-systems' })
  @ApiOkResponse({ type: AiSystemsPageDto })
  async list(@Req() req: FastifyRequest, @Query() qRaw: unknown): Promise<AiSystemsPageDto> {
    const auth = requireAuth(req);
    const q = CursorPageQuerySchema.parse(qRaw);
    return this.svc.list(auth.firmId, { ...(q.cursor !== undefined ? { cursor: q.cursor } : {}), limit: q.limit });
  }

  @Get(':id')
  @Rbac('ai-systems', 'read')
  @ApiOkResponse({ type: AiSystemsDto })
  async get(@Req() req: FastifyRequest, @Param('id') id: string): Promise<AiSystemsDto> {
    const auth = requireAuth(req);
    return this.svc.get(auth.firmId, id);
  }

  @Post()
  @Rbac('ai-systems', 'create')
  @AuditTrail({ type: 'ai-systems.created', entity: 'ai-systems' })
  @UsePipes(new ZodValidationPipe(CreateAiSystemsSchema))
  @ApiCreatedResponse({ type: AiSystemsDto })
  async create(@Req() req: FastifyRequest, @Body() body: CreateAiSystemsDto): Promise<AiSystemsDto> {
    const auth = requireAuth(req);
    return this.svc.create(auth.firmId, body);
  }

  @Patch(':id')
  @Rbac('ai-systems', 'update')
  @AuditTrail({ type: 'ai-systems.updated', entity: 'ai-systems', entityIdParam: 'id' })
  @UsePipes(new ZodValidationPipe(UpdateAiSystemsSchema))
  @ApiOkResponse({ type: AiSystemsDto })
  async update(@Req() req: FastifyRequest, @Param('id') id: string, @Body() body: UpdateAiSystemsDto): Promise<AiSystemsDto> {
    const auth = requireAuth(req);
    return this.svc.update(auth.firmId, id, body);
  }

  @Delete(':id')
  @Rbac('ai-systems', 'delete')
  @AuditTrail({ type: 'ai-systems.deleted', entity: 'ai-systems', entityIdParam: 'id' })
  async remove(@Req() req: FastifyRequest, @Param('id') id: string): Promise<{ id: string }> {
    const auth = requireAuth(req);
    await this.svc.remove(auth.firmId, id);
    return { id };
  }
}
