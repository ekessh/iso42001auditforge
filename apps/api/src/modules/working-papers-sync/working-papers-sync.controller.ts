// SPDX-License-Identifier: BUSL-1.1
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('working-papers-sync')
@Controller({ path: 'sync', version: '1' })
export class WorkingPapersSyncController {
  @Get('health')
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        ts: { type: 'string' },
      },
      required: ['ok', 'ts'],
    },
  })
  health(): { ok: true; ts: string } {
    return { ok: true, ts: new Date().toISOString() };
  }
}
