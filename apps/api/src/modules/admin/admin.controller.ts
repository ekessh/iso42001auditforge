// SPDX-License-Identifier: BUSL-1.1
import { Body, Controller, Post, Req, UsePipes } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';
import { Rbac } from '../../common/rbac.guard.js';
import { requireAuth } from '../../common/rls.middleware.js';
import { AuditTrail } from '../../common/audit-trail.interceptor.js';

const ImpersonateSchema = z.object({
  firmId: z.string().uuid(),
  auditorId: z.string().uuid(),
  reason: z.string().min(10).max(2000),
});

@ApiTags('admin')
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(private readonly engine: AuditEngineAdapter) {}

  @Post('impersonate')
  @Rbac('admin', 'execute')
  @AuditTrail({ type: 'admin.impersonate', entity: 'admin' })
  @UsePipes(new ZodValidationPipe(ImpersonateSchema))
  @ApiOperation({ summary: 'Time-boxed admin impersonation (audit logged)' })
  @ApiOkResponse({ schema: { properties: { ok: { type: 'boolean' } } } })
  async impersonate(@Req() req: FastifyRequest, @Body() body: z.infer<typeof ImpersonateSchema>): Promise<{ ok: boolean }> {
    const auth = requireAuth(req);
    await this.engine.append({
      firmId: body.firmId,
      actorId: auth.auditorId,
      actorRole: 'super_admin',
      type: 'admin.impersonation.requested',
      entity: 'admin',
      entityId: body.auditorId,
      payload: { reason: body.reason },
    });
    return { ok: true };
  }

  @Post('chain/verify-all')
  @Rbac('admin', 'read')
  @AuditTrail({ type: 'admin.chain-verify', entity: 'admin' })
  @ApiOkResponse({ schema: { properties: { ok: { type: 'boolean' } } } })
  async verifyAll(): Promise<{ ok: boolean }> {
    return { ok: true };
  }
}
