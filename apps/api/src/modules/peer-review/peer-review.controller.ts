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
import { CreatePeerReviewSchema, UpdatePeerReviewSchema, type CreatePeerReviewDto, type UpdatePeerReviewDto, PeerReviewDto, PeerReviewPageDto } from './dto.js';
import { PeerReviewService } from './peer-review.service.js';

@ApiTags('peer-review')
@Controller({ path: 'peer-review', version: '1' })
export class PeerReviewController {
  constructor(private readonly svc: PeerReviewService) {}

  @Get()
  @Rbac('peer-review', 'read')
  @ApiOperation({ summary: 'List peer-review' })
  @ApiOkResponse({ type: PeerReviewPageDto })
  async list(@Req() req: FastifyRequest, @Query() qRaw: unknown): Promise<PeerReviewPageDto> {
    const auth = requireAuth(req);
    const q = CursorPageQuerySchema.parse(qRaw);
    return this.svc.list(auth.firmId, { cursor: q.cursor, limit: q.limit });
  }

  @Get(':id')
  @Rbac('peer-review', 'read')
  @ApiOkResponse({ type: PeerReviewDto })
  async get(@Req() req: FastifyRequest, @Param('id') id: string): Promise<PeerReviewDto> {
    const auth = requireAuth(req);
    return this.svc.get(auth.firmId, id);
  }

  @Post()
  @Rbac('peer-review', 'create')
  @AuditTrail({ type: 'peer-review.created', entity: 'peer-review' })
  @UsePipes(new ZodValidationPipe(CreatePeerReviewSchema))
  @ApiCreatedResponse({ type: PeerReviewDto })
  async create(@Req() req: FastifyRequest, @Body() body: CreatePeerReviewDto): Promise<PeerReviewDto> {
    const auth = requireAuth(req);
    return this.svc.create(auth.firmId, body);
  }

  @Patch(':id')
  @Rbac('peer-review', 'update')
  @AuditTrail({ type: 'peer-review.updated', entity: 'peer-review', entityIdParam: 'id' })
  @UsePipes(new ZodValidationPipe(UpdatePeerReviewSchema))
  @ApiOkResponse({ type: PeerReviewDto })
  async update(@Req() req: FastifyRequest, @Param('id') id: string, @Body() body: UpdatePeerReviewDto): Promise<PeerReviewDto> {
    const auth = requireAuth(req);
    return this.svc.update(auth.firmId, id, body);
  }

  @Delete(':id')
  @Rbac('peer-review', 'delete')
  @AuditTrail({ type: 'peer-review.deleted', entity: 'peer-review', entityIdParam: 'id' })
  async remove(@Req() req: FastifyRequest, @Param('id') id: string): Promise<{ id: string }> {
    const auth = requireAuth(req);
    await this.svc.remove(auth.firmId, id);
    return { id };
  }
}
