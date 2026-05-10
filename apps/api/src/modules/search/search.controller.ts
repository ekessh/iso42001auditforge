// SPDX-License-Identifier: BUSL-1.1
import { Body, Controller, Post, Req, UsePipes } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { Rbac } from '../../common/rbac.guard.js';
import { requireAuth } from '../../common/rls.middleware.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { ForbiddenError } from '../../common/errors.js';
import { SearchRequestSchema, SearchResponseDto, type SearchRequest } from './dto.js';
import { SearchService } from './search.service.js';

@ApiTags('search')
@Controller({ path: 'search', version: '1' })
export class SearchController {
  constructor(private readonly svc: SearchService) {}

  @Post()
  @Rbac('search', 'read')
  @UsePipes(new ZodValidationPipe(SearchRequestSchema))
  @ApiOkResponse({ type: SearchResponseDto })
  async hybrid(@Req() req: FastifyRequest, @Body() body: SearchRequest): Promise<SearchResponseDto> {
    const result = await this.svc.hybrid(body, this.context(req));
    return result as unknown as SearchResponseDto;
  }

  @Post('semantic')
  @Rbac('search', 'read')
  @UsePipes(new ZodValidationPipe(SearchRequestSchema))
  @ApiOkResponse({ type: SearchResponseDto })
  async semantic(@Req() req: FastifyRequest, @Body() body: SearchRequest): Promise<SearchResponseDto> {
    const result = await this.svc.semantic(body, this.context(req));
    return result as unknown as SearchResponseDto;
  }

  @Post('keyword')
  @Rbac('search', 'read')
  @UsePipes(new ZodValidationPipe(SearchRequestSchema))
  @ApiOkResponse({ type: SearchResponseDto })
  async keyword(@Req() req: FastifyRequest, @Body() body: SearchRequest): Promise<SearchResponseDto> {
    const result = await this.svc.keyword(body, this.context(req));
    return result as unknown as SearchResponseDto;
  }

  private context(req: FastifyRequest): {
    firmId: string;
    engagementId: string;
    auditorId: string;
    requestId?: string;
  } {
    const auth = requireAuth(req);
    if (!auth.engagementId) {
      // Hard rule: search requires engagement scope per CLAUDE.md.
      throw new ForbiddenError('search requires an engagement-scoped session');
    }
    const requestId = (req.headers['x-request-id'] as string | undefined) ?? undefined;
    return {
      firmId: auth.firmId,
      engagementId: auth.engagementId,
      auditorId: auth.auditorId,
      ...(requestId !== undefined ? { requestId } : {}),
    };
  }
}
