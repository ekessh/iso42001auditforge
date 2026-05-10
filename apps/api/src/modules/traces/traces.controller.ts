// SPDX-License-Identifier: BUSL-1.1
import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UsePipes, Req,
} from '@nestjs/common';
import { ApiTags, ApiOkResponse, ApiCreatedResponse, ApiOperation, ApiBody } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { Rbac } from '../../common/rbac.guard.js';
import { AuditTrail } from '../../common/audit-trail.interceptor.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { CursorPageQuerySchema } from '../../common/pagination.js';
import { requireAuth } from '../../common/rls.middleware.js';
import { CreateTracesSchema, UpdateTracesSchema, type CreateTracesDto, type UpdateTracesDto, TracesDto, TracesPageDto } from './dto.js';
import { TracesService } from './traces.service.js';

const IngestTraceSchema = z.object({
  name: z.string().min(1).max(200),
  source: z.string().min(1).max(64).optional(),
  spans: z.array(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});
type IngestTraceDto = z.infer<typeof IngestTraceSchema>;

@ApiTags('traces')
@Controller({ path: 'traces', version: '1' })
export class TracesController {
  constructor(private readonly svc: TracesService) {}

  @Get()
  @Rbac('traces', 'read')
  @ApiOperation({ summary: 'List traces' })
  @ApiOkResponse({ type: TracesPageDto })
  async list(@Req() req: FastifyRequest, @Query() qRaw: unknown): Promise<TracesPageDto> {
    const auth = requireAuth(req);
    const q = CursorPageQuerySchema.parse(qRaw);
    return this.svc.list(auth.firmId, { ...(q.cursor !== undefined ? { cursor: q.cursor } : {}), limit: q.limit });
  }

  @Get(':id')
  @Rbac('traces', 'read')
  @ApiOkResponse({ type: TracesDto })
  async get(@Req() req: FastifyRequest, @Param('id') id: string): Promise<TracesDto> {
    const auth = requireAuth(req);
    return this.svc.get(auth.firmId, id);
  }

  @Post()
  @Rbac('traces', 'create')
  @AuditTrail({ type: 'traces.created', entity: 'traces' })
  @UsePipes(new ZodValidationPipe(CreateTracesSchema))
  @ApiCreatedResponse({ type: TracesDto })
  async create(@Req() req: FastifyRequest, @Body() body: CreateTracesDto): Promise<TracesDto> {
    const auth = requireAuth(req);
    return this.svc.create(auth.firmId, body);
  }

  @Post('ingest')
  @Rbac('traces', 'create')
  @AuditTrail({ type: 'traces.ingested', entity: 'traces' })
  @UsePipes(new ZodValidationPipe(IngestTraceSchema))
  @ApiOperation({ summary: 'Ingest a raw trace dump (OTel/Langfuse/Phoenix)' })
  @ApiBody({ schema: { type: 'object' } })
  @ApiCreatedResponse({ type: TracesDto })
  async ingest(@Req() req: FastifyRequest, @Body() body: IngestTraceDto): Promise<TracesDto> {
    const auth = requireAuth(req);
    const payload: Parameters<TracesService['ingest']>[1] = {
      name: body.name,
      ...(body.source !== undefined ? { source: body.source } : {}),
      ...(body.spans !== undefined ? { spans: body.spans } : {}),
      ...(body.metadata !== undefined ? { metadata: body.metadata } : {}),
    };
    return this.svc.ingest(auth.firmId, payload);
  }

  @Patch(':id')
  @Rbac('traces', 'update')
  @AuditTrail({ type: 'traces.updated', entity: 'traces', entityIdParam: 'id' })
  @UsePipes(new ZodValidationPipe(UpdateTracesSchema))
  @ApiOkResponse({ type: TracesDto })
  async update(@Req() req: FastifyRequest, @Param('id') id: string, @Body() body: UpdateTracesDto): Promise<TracesDto> {
    const auth = requireAuth(req);
    return this.svc.update(auth.firmId, id, body);
  }

  @Delete(':id')
  @Rbac('traces', 'delete')
  @AuditTrail({ type: 'traces.deleted', entity: 'traces', entityIdParam: 'id' })
  async remove(@Req() req: FastifyRequest, @Param('id') id: string): Promise<{ id: string }> {
    const auth = requireAuth(req);
    await this.svc.remove(auth.firmId, id);
    return { id };
  }
}
