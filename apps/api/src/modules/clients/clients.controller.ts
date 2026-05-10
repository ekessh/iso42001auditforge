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
import { CreateClientsSchema, UpdateClientsSchema, type CreateClientsDto, type UpdateClientsDto, ClientsDto, ClientsPageDto } from './dto.js';
import type { ClientsService } from './clients.service.js';

@ApiTags('clients')
@Controller({ path: 'clients', version: '1' })
export class ClientsController {
  constructor(private readonly svc: ClientsService) {}

  @Get()
  @Rbac('clients', 'read')
  @ApiOperation({ summary: 'List clients' })
  @ApiOkResponse({ type: ClientsPageDto })
  async list(@Req() req: FastifyRequest, @Query() qRaw: unknown): Promise<ClientsPageDto> {
    const auth = requireAuth(req);
    const q = CursorPageQuerySchema.parse(qRaw);
    return this.svc.list(auth.firmId, { ...(q.cursor !== undefined ? { cursor: q.cursor } : {}), limit: q.limit });
  }

  @Get(':id')
  @Rbac('clients', 'read')
  @ApiOkResponse({ type: ClientsDto })
  async get(@Req() req: FastifyRequest, @Param('id') id: string): Promise<ClientsDto> {
    const auth = requireAuth(req);
    return this.svc.get(auth.firmId, id);
  }

  @Post()
  @Rbac('clients', 'create')
  @AuditTrail({ type: 'clients.created', entity: 'clients' })
  @UsePipes(new ZodValidationPipe(CreateClientsSchema))
  @ApiCreatedResponse({ type: ClientsDto })
  async create(@Req() req: FastifyRequest, @Body() body: CreateClientsDto): Promise<ClientsDto> {
    const auth = requireAuth(req);
    return this.svc.create(auth.firmId, body);
  }

  @Patch(':id')
  @Rbac('clients', 'update')
  @AuditTrail({ type: 'clients.updated', entity: 'clients', entityIdParam: 'id' })
  @UsePipes(new ZodValidationPipe(UpdateClientsSchema))
  @ApiOkResponse({ type: ClientsDto })
  async update(@Req() req: FastifyRequest, @Param('id') id: string, @Body() body: UpdateClientsDto): Promise<ClientsDto> {
    const auth = requireAuth(req);
    return this.svc.update(auth.firmId, id, body);
  }

  @Delete(':id')
  @Rbac('clients', 'delete')
  @AuditTrail({ type: 'clients.deleted', entity: 'clients', entityIdParam: 'id' })
  async remove(@Req() req: FastifyRequest, @Param('id') id: string): Promise<{ id: string }> {
    const auth = requireAuth(req);
    await this.svc.remove(auth.firmId, id);
    return { id };
  }
}
