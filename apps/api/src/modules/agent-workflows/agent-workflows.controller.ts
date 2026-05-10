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
import { CreateAgentWorkflowsSchema, UpdateAgentWorkflowsSchema, type CreateAgentWorkflowsDto, type UpdateAgentWorkflowsDto, AgentWorkflowsDto, AgentWorkflowsPageDto } from './dto.js';
import { AgentWorkflowsService } from './agent-workflows.service.js';

@ApiTags('agent-workflows')
@Controller({ path: 'agent-workflows', version: '1' })
export class AgentWorkflowsController {
  constructor(private readonly svc: AgentWorkflowsService) {}

  @Get()
  @Rbac('agent-workflows', 'read')
  @ApiOperation({ summary: 'List agent-workflows' })
  @ApiOkResponse({ type: AgentWorkflowsPageDto })
  async list(@Req() req: FastifyRequest, @Query() qRaw: unknown): Promise<AgentWorkflowsPageDto> {
    const auth = requireAuth(req);
    const q = CursorPageQuerySchema.parse(qRaw);
    return this.svc.list(auth.firmId, { ...(q.cursor !== undefined ? { cursor: q.cursor } : {}), limit: q.limit });
  }

  @Get(':id')
  @Rbac('agent-workflows', 'read')
  @ApiOkResponse({ type: AgentWorkflowsDto })
  async get(@Req() req: FastifyRequest, @Param('id') id: string): Promise<AgentWorkflowsDto> {
    const auth = requireAuth(req);
    return this.svc.get(auth.firmId, id);
  }

  @Post()
  @Rbac('agent-workflows', 'create')
  @AuditTrail({ type: 'agent-workflows.created', entity: 'agent-workflows' })
  @UsePipes(new ZodValidationPipe(CreateAgentWorkflowsSchema))
  @ApiCreatedResponse({ type: AgentWorkflowsDto })
  async create(@Req() req: FastifyRequest, @Body() body: CreateAgentWorkflowsDto): Promise<AgentWorkflowsDto> {
    const auth = requireAuth(req);
    return this.svc.create(auth.firmId, body);
  }

  @Patch(':id')
  @Rbac('agent-workflows', 'update')
  @AuditTrail({ type: 'agent-workflows.updated', entity: 'agent-workflows', entityIdParam: 'id' })
  @UsePipes(new ZodValidationPipe(UpdateAgentWorkflowsSchema))
  @ApiOkResponse({ type: AgentWorkflowsDto })
  async update(@Req() req: FastifyRequest, @Param('id') id: string, @Body() body: UpdateAgentWorkflowsDto): Promise<AgentWorkflowsDto> {
    const auth = requireAuth(req);
    return this.svc.update(auth.firmId, id, body);
  }

  @Delete(':id')
  @Rbac('agent-workflows', 'delete')
  @AuditTrail({ type: 'agent-workflows.deleted', entity: 'agent-workflows', entityIdParam: 'id' })
  async remove(@Req() req: FastifyRequest, @Param('id') id: string): Promise<{ id: string }> {
    const auth = requireAuth(req);
    await this.svc.remove(auth.firmId, id);
    return { id };
  }
}
