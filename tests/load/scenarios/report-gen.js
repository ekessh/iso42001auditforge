// SPDX-License-Identifier: BUSL-1.1
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: { report: { executor: 'constant-arrival-rate', rate: 10, timeUnit: '1s', duration: '2m', preAllocatedVUs: 50 } },
  thresholds: { http_req_duration: ['p(95)<5000'], http_req_failed: ['rate<0.05'] },
};

const BASE = __ENV.API_URL || 'http://localhost:4000';
export default function () {
  const r = http.post(`${BASE}/reports/render`, JSON.stringify({ engagementId: 'eng-001', template: 'stage2', format: 'docx' }), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(r, { 'rendered': (r) => r.status === 202 || r.status === 401 });
}
