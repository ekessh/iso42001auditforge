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
import { CreateSurveillanceSchema, UpdateSurveillanceSchema, type CreateSurveillanceDto, type UpdateSurveillanceDto, SurveillanceDto, SurveillancePageDto } from './dto.js';
import type { SurveillanceService } from './surveillance.service.js';

@ApiTags('surveillance')
@Controller({ path: 'surveillance', version: '1' })
export class SurveillanceController {
  constructor(private readonly svc: SurveillanceService) {}

  @Get()
  @Rbac('surveillance', 'read')
  @ApiOperation({ summary: 'List surveillance' })
  @ApiOkResponse({ type: SurveillancePageDto })
  async list(@Req() req: FastifyRequest, @Query() qRaw: unknown): Promise<SurveillancePageDto> {
    const auth = requireAuth(req);
    const q = CursorPageQuerySchema.parse(qRaw);
    return this.svc.list(auth.firmId, { ...(q.cursor !== undefined ? { cursor: q.cursor } : {}), limit: q.limit });
  }

  @Get(':id')
  @Rbac('surveillance', 'read')
  @ApiOkResponse({ type: SurveillanceDto })
  async get(@Req() req: FastifyRequest, @Param('id') id: string): Promise<SurveillanceDto> {
    const auth = requireAuth(req);
    return this.svc.get(auth.firmId, id);
  }

  @Post()
  @Rbac('surveillance', 'create')
  @AuditTrail({ type: 'surveillance.created', entity: 'surveillance' })
  @UsePipes(new ZodValidationPipe(CreateSurveillanceSchema))
  @ApiCreatedResponse({ type: SurveillanceDto })
  async create(@Req() req: FastifyRequest, @Body() body: CreateSurveillanceDto): Promise<SurveillanceDto> {
    const auth = requireAuth(req);
    return this.svc.create(auth.firmId, body);
  }

  @Patch(':id')
  @Rbac('surveillance', 'update')
  @AuditTrail({ type: 'surveillance.updated', entity: 'surveillance', entityIdParam: 'id' })
  @UsePipes(new ZodValidationPipe(UpdateSurveillanceSchema))
  @ApiOkResponse({ type: SurveillanceDto })
  async update(@Req() req: FastifyRequest, @Param('id') id: string, @Body() body: UpdateSurveillanceDto): Promise<SurveillanceDto> {
    const auth = requireAuth(req);
    return this.svc.update(auth.firmId, id, body);
  }

  @Delete(':id')
  @Rbac('surveillance', 'delete')
  @AuditTrail({ type: 'surveillance.deleted', entity: 'surveillance', entityIdParam: 'id' })
  async remove(@Req() req: FastifyRequest, @Param('id') id: string): Promise<{ id: string }> {
    const auth = requireAuth(req);
    await this.svc.remove(auth.firmId, id);
    return { id };
  }
}
