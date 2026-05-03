// SPDX-License-Identifier: BUSL-1.1
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { buildTestApp } from '../helpers/app.js';

const FIRM_A = '11111111-1111-1111-1111-11111111aaaa';
const FIRM_B = '22222222-2222-2222-2222-22222222bbbb';
const AUDITOR_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const AUDITOR_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

describe('tenant isolation', () => {
  let app: NestFastifyApplication;
  beforeAll(async () => { app = await buildTestApp(); });
  afterAll(async () => { await app.close(); });

  function headers(firm: string, auditor: string, roles = 'lead_auditor'): Record<string, string> {
    return {
      'x-test-firm-id': firm,
      'x-test-auditor-id': auditor,
      'x-test-roles': roles,
      'content-type': 'application/json',
    };
  }

  it('engagements created by firm A are invisible to firm B', async () => {
    const create = await app.inject({
      method: 'POST', url: '/v1/engagements',
      headers: headers(FIRM_A, AUDITOR_A),
      payload: {
        clientId: '33333333-3333-3333-3333-333333333333',
        stage: 'stage1',
        scopeStatement: 'isolation-test',
        startsOn: '2026-06-01', endsOn: '2026-06-05',
        leadAuditorId: AUDITOR_A, teamMemberIds: [],
      },
    });
    expect(create.statusCode).toBe(201);
    const id = (create.json() as { id: string }).id;

    const aRead = await app.inject({ method: 'GET', url: `/v1/engagements/${id}`, headers: headers(FIRM_A, AUDITOR_A) });
    expect(aRead.statusCode).toBe(200);

    const bRead = await app.inject({ method: 'GET', url: `/v1/engagements/${id}`, headers: headers(FIRM_B, AUDITOR_B) });
    expect([403, 404]).toContain(bRead.statusCode);
  });

  it('unauthenticated request rejected', async () => {
    const r = await app.inject({ method: 'GET', url: '/v1/engagements' });
    expect(r.statusCode).toBe(401);
  });
});
