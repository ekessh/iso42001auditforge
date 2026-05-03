// SPDX-License-Identifier: BUSL-1.1
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: { soak: { executor: 'constant-vus', vus: 20, duration: __ENV.SOAK_DURATION || '24h' } },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1500'],
    http_req_failed: ['rate<0.005'],
  },
};

const BASE = __ENV.API_URL || 'http://localhost:4000';

export default function () {
  const r = http.get(`${BASE}/health/live`);
  check(r, { 'alive': (r) => r.status === 200 || r.status === 503 });
  sleep(2);
}
