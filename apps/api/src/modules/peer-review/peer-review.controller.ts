// SPDX-License-Identifier: BUSL-1.1
import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, UsePipes, Req,
} from '@nestjs/common';
import { ApiTags, ApiOkResponse, ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import type { PeerReviewRequest } from '@auditforge/peer-review';
import { Rbac } from '../../common/rbac.guard.js';
import { AuditTrail } from '../../common/audit-trail.interceptor.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { CursorPageQuerySchema } from '../../common/pagination.js';
import { requireAuth } from '../../common/rls.middleware.js';
import {
  CreatePeerReviewSchema,
  UpdatePeerReviewSchema,
  AddCommentSchema,
  ResolveCommentSchema,
  type CreatePeerReviewDto,
  type UpdatePeerReviewDto,
  type AddCommentDto,
  type ResolveCommentDto,
  PeerReviewDto,
  PeerReviewPageDto,
  PeerReviewCommentDto,
  PeerReviewCommentListDto,
} from './dto.js';
import { PeerReviewService } from './peer-review.service.js';
import { PeerReviewCommentsApiService } from './comments.service.js';

@ApiTags('peer-review')
@Controller({ path: 'peer-review', version: '1' })
export class PeerReviewController {
  constructor(
    private readonly svc: PeerReviewService,
    private readonly comments: PeerReviewCommentsApiService,
  ) {}

  @Get()
  @Rbac('peer-review', 'read')
  @ApiOperation({ summary: 'List peer-review' })
  @ApiOkResponse({ type: PeerReviewPageDto })
  async list(@Req() req: FastifyRequest, @Query() qRaw: unknown): Promise<PeerReviewPageDto> {
    const auth = requireAuth(req);
    const q = CursorPageQuerySchema.parse(qRaw);
    return this.svc.list(auth.firmId, { ...(q.cursor !== undefined ? { cursor: q.cursor } : {}), limit: q.limit });
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

  // ---------------------------------------------------------------------
  // Comment threads on a peer-review package.
  // ---------------------------------------------------------------------

  @Get(':id/comments')
  @Rbac('peer-review', 'read')
  @ApiOperation({ summary: 'List comments on a peer-review package' })
  @ApiOkResponse({ type: PeerReviewCommentListDto })
  async listComments(
    @Req() req: FastifyRequest,
    @Param('id') id: string,
  ): Promise<PeerReviewCommentListDto> {
    const auth = requireAuth(req);
    // Existence check on the package â€” also enforces RLS read.
    await this.svc.get(auth.firmId, id);
    return { items: this.comments.list(auth.firmId, id) as unknown as PeerReviewCommentDto[] };
  }

  @Post(':id/comments')
  @Rbac('peer-review', 'update')
  @AuditTrail({ type: 'peer-review.comment_added', entity: 'peer-review', entityIdParam: 'id' })
  @UsePipes(new ZodValidationPipe(AddCommentSchema))
  @ApiCreatedResponse({ type: PeerReviewCommentDto })
  async addComment(
    @Req() req: FastifyRequest,
    @Param('id') id: string,
    @Body() body: AddCommentDto,
  ): Promise<PeerReviewCommentDto> {
    const auth = requireAuth(req);
    const reqRow = await this.svc.get(auth.firmId, id);
    // The package needs a richer PeerReviewRequest; we synthesize the
    // minimum fields required by the comments service from the row.
    const synthRequest: PeerReviewRequest = {
      id: reqRow.id,
      firmId: reqRow.firmId,
      engagementId: (reqRow.metadata?.['engagementId'] as string | undefined) ?? reqRow.id,
      auditKind: 'stage2',
      primaryAuditorId: auth.auditorId ?? reqRow.firmId,
      engagementTeamIds: [],
      checklistId: 'pr-stage2-default',
      checklistVersion: '1.0.0',
      responses: [],
      status: 'in_review',
      createdAt: reqRow.createdAt,
      updatedAt: reqRow.updatedAt,
      revisionCount: 0,
    };
    const out = this.comments.add({
      firmId: auth.firmId,
      request: synthRequest,
      actorId: auth.auditorId ?? 'system',
      dto: body,
    });
    return out as unknown as PeerReviewCommentDto;
  }

  @Post(':id/comments/:commentId/resolve')
  @Rbac('peer-review', 'update')
  @AuditTrail({ type: 'peer-review.comment_resolved', entity: 'peer-review', entityIdParam: 'id' })
  @UsePipes(new ZodValidationPipe(ResolveCommentSchema))
  @ApiOkResponse({ type: PeerReviewCommentDto })
  async resolveComment(
    @Req() req: FastifyRequest,
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Body() body: ResolveCommentDto,
  ): Promise<PeerReviewCommentDto> {
    const auth = requireAuth(req);
    const reqRow = await this.svc.get(auth.firmId, id);
    const synthRequest: PeerReviewRequest = {
      id: reqRow.id,
      firmId: reqRow.firmId,
      engagementId: (reqRow.metadata?.['engagementId'] as string | undefined) ?? reqRow.id,
      auditKind: 'stage2',
      primaryAuditorId: auth.auditorId ?? reqRow.firmId,
      engagementTeamIds: [],
      checklistId: 'pr-stage2-default',
      checklistVersion: '1.0.0',
      responses: [],
      status: 'in_review',
      createdAt: reqRow.createdAt,
      updatedAt: reqRow.updatedAt,
      revisionCount: 0,
    };
    const out = this.comments.resolve({
      firmId: auth.firmId,
      request: synthRequest,
      commentId,
      actorId: auth.auditorId ?? 'system',
      dto: body,
    });
    return out as unknown as PeerReviewCommentDto;
  }
}
