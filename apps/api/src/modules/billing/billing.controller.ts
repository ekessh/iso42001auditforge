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
import { CreateBillingSchema, UpdateBillingSchema, type CreateBillingDto, type UpdateBillingDto, BillingDto, BillingPageDto } from './dto.js';
import type { BillingService } from './billing.service.js';

@ApiTags('billing')
@Controller({ path: 'billing', version: '1' })
export class BillingController {
  constructor(private readonly svc: BillingService) {}

  @Get()
  @Rbac('billing', 'read')
  @ApiOperation({ summary: 'List billing' })
  @ApiOkResponse({ type: BillingPageDto })
  async list(@Req() req: FastifyRequest, @Query() qRaw: unknown): Promise<BillingPageDto> {
    const auth = requireAuth(req);
    const q = CursorPageQuerySchema.parse(qRaw);
    return this.svc.list(auth.firmId, { ...(q.cursor !== undefined ? { cursor: q.cursor } : {}), limit: q.limit });
  }

  @Get(':id')
  @Rbac('billing', 'read')
  @ApiOkResponse({ type: BillingDto })
  async get(@Req() req: FastifyRequest, @Param('id') id: string): Promise<BillingDto> {
    const auth = requireAuth(req);
    return this.svc.get(auth.firmId, id);
  }

  @Post()
  @Rbac('billing', 'create')
  @AuditTrail({ type: 'billing.created', entity: 'billing' })
  @UsePipes(new ZodValidationPipe(CreateBillingSchema))
  @ApiCreatedResponse({ type: BillingDto })
  async create(@Req() req: FastifyRequest, @Body() body: CreateBillingDto): Promise<BillingDto> {
    const auth = requireAuth(req);
    return this.svc.create(auth.firmId, body);
  }

  @Patch(':id')
  @Rbac('billing', 'update')
  @AuditTrail({ type: 'billing.updated', entity: 'billing', entityIdParam: 'id' })
  @UsePipes(new ZodValidationPipe(UpdateBillingSchema))
  @ApiOkResponse({ type: BillingDto })
  async update(@Req() req: FastifyRequest, @Param('id') id: string, @Body() body: UpdateBillingDto): Promise<BillingDto> {
    const auth = requireAuth(req);
    return this.svc.update(auth.firmId, id, body);
  }

  @Delete(':id')
  @Rbac('billing', 'delete')
  @AuditTrail({ type: 'billing.deleted', entity: 'billing', entityIdParam: 'id' })
  async remove(@Req() req: FastifyRequest, @Param('id') id: string): Promise<{ id: string }> {
    const auth = requireAuth(req);
    await this.svc.remove(auth.firmId, id);
    return { id };
  }
}
