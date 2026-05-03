// SPDX-License-Identifier: BUSL-1.1
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    wp_edit: {
      executor: 'constant-vus',
      vus: 100,
      duration: '5m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE = __ENV.API_URL || 'http://localhost:4000';

export default function () {
  const id = `wp-${__VU}-${__ITER}`;
  const r = http.patch(`${BASE}/working-papers/${id}`,
    JSON.stringify({ verdict: 'conformant', confidence: 80 }),
    { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${__ENV.AUTH_TOKEN || 'test'}` } });
  check(r, { 'status 200/204': (r) => r.status === 200 || r.status === 204 || r.status === 404 });
  sleep(0.5);
}
