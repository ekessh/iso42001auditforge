// SPDX-License-Identifier: BUSL-1.1
import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { Rbac } from '../../common/rbac.guard.js';
import { requireAuth } from '../../common/rls.middleware.js';
import { ChainVerificationDto, LedgerPageDto, LedgerQuerySchema } from './dto.js';
import type { AuditLedgerService } from './audit-ledger.service.js';

@ApiTags('audit-ledger')
@Controller({ path: 'audit-ledger', version: '1' })
export class AuditLedgerController {
  constructor(private readonly svc: AuditLedgerService) {}

  @Get('events')
  @Rbac('audit-ledger', 'read')
  @ApiOperation({ summary: 'Stream ledger events for the current firm' })
  @ApiOkResponse({ type: LedgerPageDto })
  list(@Req() req: FastifyRequest, @Query() qRaw: unknown): Promise<LedgerPageDto> {
    const auth = requireAuth(req);
    const q = LedgerQuerySchema.parse(qRaw);
    return this.svc.list(auth.firmId, { limit: q.limit });
  }

  @Get('verify')
  @Rbac('audit-ledger', 'read')
  @ApiOperation({ summary: 'Verify the hash chain for the current firm' })
  @ApiOkResponse({ type: ChainVerificationDto })
  verify(@Req() req: FastifyRequest): Promise<ChainVerificationDto> {
    return this.svc.verify(requireAuth(req).firmId);
  }
}
