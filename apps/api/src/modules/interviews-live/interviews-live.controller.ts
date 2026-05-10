// SPDX-License-Identifier: BUSL-1.1
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UsePipes,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { AuditTrail } from '../../common/audit-trail.interceptor.js';
import { Rbac } from '../../common/rbac.guard.js';
import { requireAuth } from '../../common/rls.middleware.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import {
  CoverageDeltaDto,
  InterviewSessionDto,
  InterviewTranscriptDto,
  StartInterviewSchema,
  type StartInterviewDto,
} from './dto.js';
import { InterviewsLiveService } from './interviews-live.service.js';

@ApiTags('interviews-live')
@Controller({ path: 'interviews', version: '1' })
export class InterviewsLiveController {
  constructor(private readonly svc: InterviewsLiveService) {}

  @Post()
  @Rbac('interview', 'create')
  @AuditTrail({ type: 'interview.live.started', entity: 'interview_session' })
  @UsePipes(new ZodValidationPipe(StartInterviewSchema))
  @ApiOperation({ summary: 'Start a live interview session.' })
  @ApiCreatedResponse({ type: InterviewSessionDto })
  start(
    @Req() req: FastifyRequest,
    @Body() body: StartInterviewDto,
  ): Promise<InterviewSessionDto> {
    return this.svc.start(requireAuth(req).firmId, body);
  }

  @Patch(':id/end')
  @Rbac('interview', 'update')
  @AuditTrail({
    type: 'interview.live.ended',
    entity: 'interview_session',
    entityIdParam: 'id',
  })
  @ApiOkResponse({ type: InterviewSessionDto })
  end(
    @Req() req: FastifyRequest,
    @Param('id') id: string,
  ): Promise<InterviewSessionDto> {
    return this.svc.end(requireAuth(req).firmId, id);
  }

  @Get(':id/transcript')
  @Rbac('interview', 'read')
  @ApiOkResponse({ type: InterviewTranscriptDto })
  transcript(
    @Req() req: FastifyRequest,
    @Param('id') id: string,
  ): InterviewTranscriptDto {
    return this.svc.transcript_(requireAuth(req).firmId, id);
  }

  @Get(':id/coverage-delta')
  @Rbac('interview', 'read')
  @ApiOkResponse({ type: CoverageDeltaDto })
  coverage(
    @Req() req: FastifyRequest,
    @Param('id') id: string,
  ): CoverageDeltaDto {
    return this.svc.coverage(requireAuth(req).firmId, id);
  }
}
