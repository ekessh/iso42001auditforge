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
import {
  CreateInterviewsSchema,
  UpdateInterviewsSchema,
  ComposeInterviewPlanSchema,
  type CreateInterviewsDto,
  type UpdateInterviewsDto,
  type ComposeInterviewPlanDto,
  InterviewsDto,
  InterviewsPageDto,
  InterviewLibraryListDto,
  InterviewPlanDto,
} from './dto.js';
import type { InterviewsService } from './interviews.service.js';

@ApiTags('interviews')
@Controller({ path: 'interviews', version: '1' })
export class InterviewsController {
  constructor(private readonly svc: InterviewsService) {}

  @Get()
  @Rbac('interviews', 'read')
  @ApiOperation({ summary: 'List interviews' })
  @ApiOkResponse({ type: InterviewsPageDto })
  async list(@Req() req: FastifyRequest, @Query() qRaw: unknown): Promise<InterviewsPageDto> {
    const auth = requireAuth(req);
    const q = CursorPageQuerySchema.parse(qRaw);
    return this.svc.list(auth.firmId, { ...(q.cursor !== undefined ? { cursor: q.cursor } : {}), limit: q.limit });
  }

  @Get('library')
  @Rbac('interviews', 'read')
  @ApiOperation({ summary: 'List curated interview library entries (filterable).' })
  @ApiOkResponse({ type: InterviewLibraryListDto })
  async library(
    @Req() req: FastifyRequest,
    @Query('role') role?: string,
    @Query('clause') clause?: string,
    @Query('mode') mode?: string,
  ): Promise<InterviewLibraryListDto> {
    void req;
    const filter = {
      ...(role ? { roles: [role as never] } : {}),
      ...(clause ? { clauses: [clause] } : {}),
      ...(mode ? { modes: [mode as never] } : {}),
    };
    return { items: this.svc.listLibrary(filter) as unknown as InterviewLibraryListDto['items'] };
  }

  @Post('plan')
  @Rbac('interviews', 'create')
  @AuditTrail({ type: 'interviews.plan_composed', entity: 'interviews' })
  @UsePipes(new ZodValidationPipe(ComposeInterviewPlanSchema))
  @ApiOperation({ summary: 'Compose a time-boxed interview plan from the library.' })
  @ApiCreatedResponse({ type: InterviewPlanDto })
  async composePlan(
    @Req() req: FastifyRequest,
    @Body() body: ComposeInterviewPlanDto,
  ): Promise<InterviewPlanDto> {
    void req;
    return this.svc.compose(body) as unknown as InterviewPlanDto;
  }

  @Get(':id')
  @Rbac('interviews', 'read')
  @ApiOkResponse({ type: InterviewsDto })
  async get(@Req() req: FastifyRequest, @Param('id') id: string): Promise<InterviewsDto> {
    const auth = requireAuth(req);
    return this.svc.get(auth.firmId, id);
  }

  @Post()
  @Rbac('interviews', 'create')
  @AuditTrail({ type: 'interviews.created', entity: 'interviews' })
  @UsePipes(new ZodValidationPipe(CreateInterviewsSchema))
  @ApiCreatedResponse({ type: InterviewsDto })
  async create(@Req() req: FastifyRequest, @Body() body: CreateInterviewsDto): Promise<InterviewsDto> {
    const auth = requireAuth(req);
    return this.svc.create(auth.firmId, body);
  }

  @Patch(':id')
  @Rbac('interviews', 'update')
  @AuditTrail({ type: 'interviews.updated', entity: 'interviews', entityIdParam: 'id' })
  @UsePipes(new ZodValidationPipe(UpdateInterviewsSchema))
  @ApiOkResponse({ type: InterviewsDto })
  async update(@Req() req: FastifyRequest, @Param('id') id: string, @Body() body: UpdateInterviewsDto): Promise<InterviewsDto> {
    const auth = requireAuth(req);
    return this.svc.update(auth.firmId, id, body);
  }

  @Delete(':id')
  @Rbac('interviews', 'delete')
  @AuditTrail({ type: 'interviews.deleted', entity: 'interviews', entityIdParam: 'id' })
  async remove(@Req() req: FastifyRequest, @Param('id') id: string): Promise<{ id: string }> {
    const auth = requireAuth(req);
    await this.svc.remove(auth.firmId, id);
    return { id };
  }
}
