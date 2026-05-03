// SPDX-License-Identifier: BUSL-1.1
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { buildTestApp } from '../helpers/app.js';

const FIRM = '11111111-1111-1111-1111-11111111aaaa';
const AUDITOR = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

interface Cell {
  role: string;
  resource: string;
  action: 'GET' | 'POST';
  url: string;
  expectedStatuses: number[];
  payload?: unknown;
}

const ENG_PAYLOAD = {
  clientId: '33333333-3333-3333-3333-333333333333',
  stage: 'stage1', scopeStatement: 'rbac-test',
  startsOn: '2026-06-01', endsOn: '2026-06-05',
  leadAuditorId: AUDITOR, teamMemberIds: [],
};

const MATRIX: Cell[] = [
  { role: 'observer', resource: 'engagements', action: 'GET', url: '/v1/engagements', expectedStatuses: [200] },
  { role: 'observer', resource: 'engagements', action: 'POST', url: '/v1/engagements', payload: ENG_PAYLOAD, expectedStatuses: [403] },
  { role: 'auditor', resource: 'reports', action: 'POST', url: '/v1/reports', payload: { engagementId: '00000000-0000-4000-8000-000000000111', kind: 'stage1', title: 't', bodyMarkdown: '' }, expectedStatuses: [403] },
  { role: 'lead_auditor', resource: 'reports', action: 'POST', url: '/v1/reports', payload: { engagementId: '00000000-0000-4000-8000-000000000111', kind: 'stage1', title: 't', bodyMarkdown: '' }, expectedStatuses: [201] },
  { role: 'peer_reviewer', resource: 'engagements', action: 'POST', url: '/v1/engagements', payload: ENG_PAYLOAD, expectedStatuses: [403] },
  { role: 'firm_admin', resource: 'engagements', action: 'POST', url: '/v1/engagements', payload: ENG_PAYLOAD, expectedStatuses: [201] },
];

describe('RBAC matrix', () => {
  let app: NestFastifyApplication;
  beforeAll(async () => { app = await buildTestApp(); });
  afterAll(async () => { await app.close(); });

  for (const cell of MATRIX) {
    it(`${cell.role} ${cell.action} ${cell.url} -> ${cell.expectedStatuses.join('/')}`, async () => {
      const r = await app.inject({
        method: cell.action,
        url: cell.url,
        headers: {
          'x-test-firm-id': FIRM,
          'x-test-auditor-id': AUDITOR,
          'x-test-roles': cell.role,
          'content-type': 'application/json',
        },
        ...(cell.payload ? { payload: cell.payload } : {}),
      });
      expect(cell.expectedStatuses).toContain(r.statusCode);
    });
  }
});
