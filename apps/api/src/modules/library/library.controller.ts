// SPDX-License-Identifier: BUSL-1.1
import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Rbac } from '../../common/rbac.guard.js';
import { LibraryPageDto, LibraryQuerySchema } from './dto.js';
import type { LibraryService } from './library.service.js';

@ApiTags('library')
@Controller({ path: 'library', version: '1' })
export class LibraryController {
  constructor(private readonly svc: LibraryService) {}

  @Get()
  @Rbac('catalogue', 'read')
  @ApiOperation({ summary: 'Search the question library + framework catalogues' })
  @ApiOkResponse({ type: LibraryPageDto })
  list(@Query() qRaw: unknown): Promise<LibraryPageDto> {
    const q = LibraryQuerySchema.parse(qRaw);
    return this.svc.list(q);
  }
}
