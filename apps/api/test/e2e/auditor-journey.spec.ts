// SPDX-License-Identifier: BUSL-1.1
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { buildTestApp } from '../helpers/app.js';

const FIRM = '11111111-1111-1111-1111-11111111aaaa';
const AUDITOR = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

describe('auditor journey: login → engagement → working paper → finding → report → sign', () => {
  let app: NestFastifyApplication;
  beforeAll(async () => { app = await buildTestApp(); });
  afterAll(async () => { await app.close(); });

  const headers = (extra: Record<string, string> = {}): Record<string, string> => ({
    'x-test-firm-id': FIRM,
    'x-test-auditor-id': AUDITOR,
    'x-test-roles': 'lead_auditor',
    'content-type': 'application/json',
    ...extra,
  });

  it('runs the journey end-to-end', async () => {
    // 1. Identity (mock register/login as a no-op since dev middleware injects identity).
    const loginStart = await app.inject({
      method: 'POST', url: '/v1/identity/webauthn/login/start',
      headers: { 'content-type': 'application/json' },
      payload: { username: 'lead@firm.test' },
    });
    expect([200, 401]).toContain(loginStart.statusCode); // user may not exist in clean app

    // 2. Create engagement
    const eng = await app.inject({
      method: 'POST', url: '/v1/engagements', headers: headers(),
      payload: {
        clientId: '33333333-3333-3333-3333-333333333333', stage: 'stage1',
        scopeStatement: 'AIMS scope', startsOn: '2026-06-01', endsOn: '2026-06-05',
        leadAuditorId: AUDITOR, teamMemberIds: [],
      },
    });
    expect(eng.statusCode).toBe(201);
    const engagementId = (eng.json() as { id: string }).id;

    // 3. Working paper draft
    const wp = await app.inject({
      method: 'POST', url: '/v1/working-papers', headers: headers(),
      payload: { engagementId, title: 'WP-A.6.2', controlRef: 'A.6.2', bodyMarkdown: '# Notes', evidenceRefs: [] },
    });
    expect(wp.statusCode).toBe(201);

    // 4. Raise a finding
    const fnd = await app.inject({
      method: 'POST', url: '/v1/findings', headers: headers(),
      payload: { engagementId, controlRef: 'A.6.2', severity: 'minor_nc', title: 'gap', description: 'desc', evidence: [] },
    });
    expect(fnd.statusCode).toBe(201);

    // 5. Draft report
    const rpt = await app.inject({
      method: 'POST', url: '/v1/reports', headers: headers(),
      payload: { engagementId, kind: 'stage2', title: 'Stage 2 Report', bodyMarkdown: '' },
    });
    expect(rpt.statusCode).toBe(201);
    const reportId = (rpt.json() as { id: string }).id;

    // 6. Sign report (mocked attestation)
    const sign = await app.inject({
      method: 'POST', url: `/v1/reports/${reportId}/sign`,
      headers: headers({ 'x-webauthn-attestation': 'a'.repeat(32) }),
      payload: { attestation: 'a'.repeat(32) },
    });
    expect(sign.statusCode).toBe(200);
    expect((sign.json() as { status: string }).status).toBe('issued');
  });
});
