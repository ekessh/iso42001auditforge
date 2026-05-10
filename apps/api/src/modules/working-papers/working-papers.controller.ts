// SPDX-License-Identifier: BUSL-1.1
import { Body, Controller, Get, Param, Patch, Post, Query, Req, UsePipes } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { AuditTrail } from '../../common/audit-trail.interceptor.js';
import { CursorPageQuerySchema } from '../../common/pagination.js';
import { Rbac } from '../../common/rbac.guard.js';
import { requireAuth } from '../../common/rls.middleware.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import {
  CreateWorkingPaperSchema,
  UpdateWorkingPaperSchema,
  WorkingPaperDto,
  WorkingPaperPageDto,
  type CreateWorkingPaperDto,
  type UpdateWorkingPaperDto,
} from './dto.js';
import { WorkingPapersService } from './working-papers.service.js';

@ApiTags('working-papers')
@Controller({ path: 'working-papers', version: '1' })
export class WorkingPapersController {
  constructor(private readonly svc: WorkingPapersService) {}

  @Get()
  @Rbac('working-papers', 'read')
  @ApiOkResponse({ type: WorkingPaperPageDto })
  list(@Req() req: FastifyRequest, @Query() qRaw: unknown, @Query('engagementId') engagementId?: string): Promise<WorkingPaperPageDto> {
    const auth = requireAuth(req);
    const q = CursorPageQuerySchema.parse(qRaw);
    return this.svc.list(auth.firmId, { ...(engagementId ? { engagementId } : {}), ...(q.cursor !== undefined ? { cursor: q.cursor } : {}), limit: q.limit });
  }

  @Get(':id')
  @Rbac('working-papers', 'read')
  @ApiOkResponse({ type: WorkingPaperDto })
  get(@Req() req: FastifyRequest, @Param('id') id: string): Promise<WorkingPaperDto> {
    return this.svc.get(requireAuth(req).firmId, id);
  }

  @Post()
  @Rbac('working-papers', 'create')
  @AuditTrail({ type: 'working-paper.created', entity: 'working-paper' })
  @UsePipes(new ZodValidationPipe(CreateWorkingPaperSchema))
  @ApiCreatedResponse({ type: WorkingPaperDto })
  create(@Req() req: FastifyRequest, @Body() body: CreateWorkingPaperDto): Promise<WorkingPaperDto> {
    return this.svc.create(requireAuth(req).firmId, body);
  }

  @Patch(':id')
  @Rbac('working-papers', 'update')
  @AuditTrail({ type: 'working-paper.updated', entity: 'working-paper', entityIdParam: 'id' })
  @UsePipes(new ZodValidationPipe(UpdateWorkingPaperSchema))
  @ApiOkResponse({ type: WorkingPaperDto })
  update(@Req() req: FastifyRequest, @Param('id') id: string, @Body() body: UpdateWorkingPaperDto): Promise<WorkingPaperDto> {
    return this.svc.update(requireAuth(req).firmId, id, body);
  }

  @Post(':id/submit')
  @Rbac('working-papers', 'update')
  @AuditTrail({ type: 'working-paper.submitted', entity: 'working-paper', entityIdParam: 'id' })
  @ApiOkResponse({ type: WorkingPaperDto })
  submit(@Req() req: FastifyRequest, @Param('id') id: string): Promise<WorkingPaperDto> {
    return this.svc.submitForReview(requireAuth(req).firmId, id);
  }

  @Post(':id/finalize')
  @Rbac('working-papers', 'update')
  @AuditTrail({ type: 'working-paper.finalized', entity: 'working-paper', entityIdParam: 'id' })
  @ApiOkResponse({ type: WorkingPaperDto })
  finalize(@Req() req: FastifyRequest, @Param('id') id: string): Promise<WorkingPaperDto> {
    return this.svc.finalize(requireAuth(req).firmId, id);
  }
}
