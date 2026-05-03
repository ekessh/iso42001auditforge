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
  DownloadUrlDto,
  EvidenceDto,
  EvidencePageDto,
  FinalizeUploadSchema,
  PresignUploadSchema,
  PresignedUploadResponseDto,
  type FinalizeUploadDto,
  type PresignUploadDto,
} from './dto.js';
import { EvidenceService } from './evidence-vault.service.js';

@ApiTags('evidence-vault')
@Controller({ path: 'evidence', version: '1' })
export class EvidenceController {
  constructor(private readonly svc: EvidenceService) {}

  @Post('uploads/presign')
  @Rbac('evidence-vault', 'create')
  @UsePipes(new ZodValidationPipe(PresignUploadSchema))
  @ApiOperation({ summary: 'Get a presigned URL for direct browser upload' })
  @ApiCreatedResponse({ type: PresignedUploadResponseDto })
  presign(@Req() req: FastifyRequest, @Body() body: PresignUploadDto): Promise<PresignedUploadResponseDto> {
    return this.svc.presign(requireAuth(req).firmId, body);
  }

  @Post('uploads/finalize')
  @Rbac('evidence-vault', 'create')
  @AuditTrail({ type: 'evidence.uploaded', entity: 'evidence' })
  @UsePipes(new ZodValidationPipe(FinalizeUploadSchema))
  @ApiCreatedResponse({ type: EvidenceDto })
  finalize(@Req() req: FastifyRequest, @Body() body: FinalizeUploadDto): Promise<EvidenceDto> {
    return this.svc.finalize(requireAuth(req).firmId, body);
  }

  @Get()
  @Rbac('evidence-vault', 'read')
  @ApiOkResponse({ type: EvidencePageDto })
  list(@Req() req: FastifyRequest, @Query() qRaw: unknown, @Query('engagementId') engagementId?: string): Promise<EvidencePageDto> {
    const auth = requireAuth(req);
    const q = CursorPageQuerySchema.parse(qRaw);
    return this.svc.list(auth.firmId, { ...(engagementId ? { engagementId } : {}), cursor: q.cursor, limit: q.limit });
  }

  @Get(':id')
  @Rbac('evidence-vault', 'read')
  @ApiOkResponse({ type: EvidenceDto })
  get(@Req() req: FastifyRequest, @Param('id') id: string): Promise<EvidenceDto> {
    return this.svc.get(requireAuth(req).firmId, id);
  }

  @Post(':id/download-url')
  @Rbac('evidence-vault', 'read')
  @ApiOkResponse({ type: DownloadUrlDto })
  download(@Req() req: FastifyRequest, @Param('id') id: string): Promise<DownloadUrlDto> {
    return this.svc.signedDownload(requireAuth(req).firmId, id);
  }
}
