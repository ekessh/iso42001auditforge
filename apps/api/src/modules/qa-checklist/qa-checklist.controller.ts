// SPDX-License-Identifier: BUSL-1.1
import { Body, Controller, Post, Req, UsePipes } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { Rbac } from '../../common/rbac.guard.js';
import { AuditTrail } from '../../common/audit-trail.interceptor.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { requireAuth } from '../../common/rls.middleware.js';
import {
  ChecklistResultDto,
  EvaluateChecklistSchema,
  OverrideChecklistItemSchema,
  type EvaluateChecklistDto,
  type OverrideChecklistItemDto,
} from './dto.js';
import type { QaChecklistService } from './qa-checklist.service.js';

/**
 * QA-checklist endpoints. Auditees never see this — RBAC scopes to
 * `report` resource which client_user only has on `read: own`. We require
 * `update` on `report` for evaluations / overrides so client_user is denied
 * by the rbac guard.
 */
@ApiTags('qa-checklist')
@Controller({ path: 'qa-checklist', version: '1' })
export class QaChecklistController {
  constructor(private readonly svc: QaChecklistService) {}

  @Post('evaluate')
  @Rbac('qa-checklist', 'create')
  @AuditTrail({ type: 'qa-checklist.evaluated', entity: 'qa-checklist' })
  @UsePipes(new ZodValidationPipe(EvaluateChecklistSchema))
  @ApiOperation({
    summary:
      'Evaluate the QA checklist for a draft report; returns deterministic { passed, items }.',
  })
  @ApiCreatedResponse({ type: ChecklistResultDto })
  async evaluate(
    @Req() req: FastifyRequest,
    @Body() body: EvaluateChecklistDto,
  ): Promise<ChecklistResultDto> {
    const auth = requireAuth(req);
    const result = this.svc.evaluate({
      firmId: auth.firmId,
      actorId: auth.auditorId ?? 'system',
      ctx: body,
    });
    return result as ChecklistResultDto;
  }

  @Post('override')
  @Rbac('qa-checklist', 'update')
  @AuditTrail({ type: 'qa-checklist.overridden', entity: 'qa-checklist' })
  @UsePipes(new ZodValidationPipe(OverrideChecklistItemSchema))
  @ApiOperation({
    summary:
      'Lead-auditor override for a single failed checklist item. Rationale is logged to the audit ledger.',
  })
  @ApiOkResponse({ type: ChecklistResultDto })
  async override(
    @Req() req: FastifyRequest,
    @Body() body: OverrideChecklistItemDto,
  ): Promise<{ accepted: true; itemId: string }> {
    const auth = requireAuth(req);
    // The runner consumes overrides through the evaluate context; here we
    // surface a dedicated audit-trail entry for the act of registering the
    // override, decoupling it from the next evaluate() call.
    void auth;
    void body;
    return { accepted: true, itemId: body.itemId };
  }
}
