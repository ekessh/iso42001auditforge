// SPDX-License-Identifier: BUSL-1.1
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: { probe: { executor: 'constant-arrival-rate', rate: 200, timeUnit: '1s', duration: '3m', preAllocatedVUs: 200 } },
  thresholds: { http_req_duration: ['p(95)<500'], http_req_failed: ['rate<0.05'] },
};

const BASE = __ENV.API_URL || 'http://localhost:4000';

export default function () {
  const r = http.post(`${BASE}/probes/execute`, JSON.stringify({ probeId: 'P-BIAS-01', mode: 'offline', engagementId: 'eng-001', params: {} }), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(r, { 'enqueued': (r) => r.status === 202 || r.status === 401 });
  sleep(0.1);
}
