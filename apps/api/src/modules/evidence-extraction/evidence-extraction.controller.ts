// SPDX-License-Identifier: BUSL-1.1
import { Body, Controller, Post, Req, UsePipes } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { AuditTrail } from '../../common/audit-trail.interceptor.js';
import { Rbac } from '../../common/rbac.guard.js';
import { requireAuth } from '../../common/rls.middleware.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import {
  ExtractEvidenceSchema,
  ExtractedFieldDto,
  type ExtractEvidenceDto,
} from './dto.js';
import { EvidenceExtractionService } from './evidence-extraction.service.js';

@ApiTags('evidence-extraction')
@Controller({ path: 'evidence-extract', version: '1' })
export class EvidenceExtractionController {
  constructor(private readonly svc: EvidenceExtractionService) {}

  @Post()
  @Rbac('evidence-vault', 'create')
  @AuditTrail({
    type: 'evidence.extraction.requested',
    entity: 'evidence_extraction',
  })
  @UsePipes(new ZodValidationPipe(ExtractEvidenceSchema))
  @ApiOperation({
    summary:
      'Run schema-constrained VLM extraction over an uploaded image (model card, datasheet, fairness report, incident log).',
  })
  @ApiCreatedResponse({ type: ExtractedFieldDto })
  extract(
    @Req() req: FastifyRequest,
    @Body() body: ExtractEvidenceDto,
  ): Promise<ExtractedFieldDto> {
    return this.svc.extract(requireAuth(req).firmId, body);
  }
}
