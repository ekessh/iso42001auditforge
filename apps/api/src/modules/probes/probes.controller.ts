// SPDX-License-Identifier: BUSL-1.1
import { Body, Controller, Get, Param, Post, Query, Req, UsePipes } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { AuditTrail } from '../../common/audit-trail.interceptor.js';
import { CursorPageQuerySchema } from '../../common/pagination.js';
import { Rbac } from '../../common/rbac.guard.js';
import { requireAuth } from '../../common/rls.middleware.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import {
  CreateProbeDefinitionSchema,
  ExecuteProbeSchema,
  ProbeDefinitionDto,
  ProbeExecutionDto,
  ProbeExecutionPageDto,
  ProbePageDto,
  type CreateProbeDefinitionDto,
  type ExecuteProbeDto,
} from './dto.js';
import { ProbesService } from './probes.service.js';

@ApiTags('probes')
@Controller({ path: 'probes', version: '1' })
export class ProbesController {
  constructor(private readonly svc: ProbesService) {}

  @Get()
  @Rbac('probes', 'read')
  @ApiOkResponse({ type: ProbePageDto })
  list(@Req() req: FastifyRequest, @Query() qRaw: unknown): Promise<ProbePageDto> {
    const auth = requireAuth(req);
    const q = CursorPageQuerySchema.parse(qRaw);
    return this.svc.listDefinitions(auth.firmId, { ...(q.cursor !== undefined ? { cursor: q.cursor } : {}), limit: q.limit });
  }

  @Post()
  @Rbac('probes', 'create')
  @AuditTrail({ type: 'probe.created', entity: 'probe' })
  @UsePipes(new ZodValidationPipe(CreateProbeDefinitionSchema))
  @ApiCreatedResponse({ type: ProbeDefinitionDto })
  create(@Req() req: FastifyRequest, @Body() body: CreateProbeDefinitionDto): Promise<ProbeDefinitionDto> {
    return this.svc.createDefinition(requireAuth(req).firmId, body);
  }

  @Get(':id')
  @Rbac('probes', 'read')
  @ApiOkResponse({ type: ProbeDefinitionDto })
  get(@Req() req: FastifyRequest, @Param('id') id: string): Promise<ProbeDefinitionDto> {
    return this.svc.getDefinition(requireAuth(req).firmId, id);
  }

  @Post(':id/execute')
  @Rbac('probes', 'create')
  @AuditTrail({ type: 'probe.execute-queued', entity: 'probe', entityIdParam: 'id' })
  @UsePipes(new ZodValidationPipe(ExecuteProbeSchema))
  @ApiOperation({ summary: 'Queue a probe execution' })
  @ApiCreatedResponse({ type: ProbeExecutionDto })
  execute(@Req() req: FastifyRequest, @Param('id') id: string, @Body() body: ExecuteProbeDto): Promise<ProbeExecutionDto> {
    return this.svc.execute(requireAuth(req).firmId, id, body);
  }

  @Get('executions/list')
  @Rbac('probes', 'read')
  @ApiOkResponse({ type: ProbeExecutionPageDto })
  listExecutions(@Req() req: FastifyRequest, @Query() qRaw: unknown, @Query('engagementId') engagementId?: string): Promise<ProbeExecutionPageDto> {
    const auth = requireAuth(req);
    const q = CursorPageQuerySchema.parse(qRaw);
    return this.svc.listExecutions(auth.firmId, { ...(engagementId ? { engagementId } : {}), ...(q.cursor !== undefined ? { cursor: q.cursor } : {}), limit: q.limit });
  }

  @Get('executions/:executionId')
  @Rbac('probes', 'read')
  @ApiOkResponse({ type: ProbeExecutionDto })
  getExecution(@Req() req: FastifyRequest, @Param('executionId') executionId: string): Promise<ProbeExecutionDto> {
    return this.svc.getExecution(requireAuth(req).firmId, executionId);
  }

  @Get('budget/:engagementId')
  @Rbac('probes', 'read')
  @ApiOkResponse({ schema: { properties: { spent: { type: 'number' }, allowance: { type: 'number' }, remaining: { type: 'number' } } } })
  budget(@Req() req: FastifyRequest, @Param('engagementId') engagementId: string): Promise<{ spent: number; allowance: number; remaining: number }> {
    return this.svc.budgetSummary(requireAuth(req).firmId, engagementId);
  }
}
