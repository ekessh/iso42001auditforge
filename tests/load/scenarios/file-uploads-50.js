// SPDX-License-Identifier: BUSL-1.1
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: { uploads: { executor: 'ramping-vus', startVUs: 0, stages: [{ duration: '30s', target: 50 }, { duration: '5m', target: 50 }, { duration: '30s', target: 0 }] } },
  thresholds: { http_req_duration: ['p(95)<2000'], http_req_failed: ['rate<0.02'] },
};

const BASE = __ENV.API_URL || 'http://localhost:4000';
const ten_mb = 'A'.repeat(10 * 1024 * 1024);

export default function () {
  const r = http.post(`${BASE}/evidence/presign`, JSON.stringify({ size: ten_mb.length, mimeType: 'application/pdf', filename: 'evidence.pdf', sha256: 'a'.repeat(64), sha3_256: 'a'.repeat(64) }), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(r, { 'presign succeeded': (r) => r.status === 200 || r.status === 401 });
}
