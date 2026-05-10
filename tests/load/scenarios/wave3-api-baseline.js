// SPDX-License-Identifier: BUSL-1.1
// k6 baseline: 50 VUs, 5min, GET hot endpoints. p95 < 300ms target.
import http from 'k6/http';
import { check } from 'k6';
import { Trend } from 'k6/metrics';

const engagementListLatency = new Trend('engagement_list_ms', true);
const findingListLatency = new Trend('finding_list_ms', true);

export const options = {
  scenarios: {
    api_baseline: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<300', 'p(99)<800'],
    'http_req_failed': ['rate<0.01'],
    'engagement_list_ms': ['p(95)<300'],
    'finding_list_ms': ['p(95)<300'],
  },
  summaryTrendStats: ['min', 'med', 'avg', 'p(95)', 'p(99)', 'max'],
};

const BASE = __ENV.API_URL || 'http://localhost:3001';
const TOKEN = __ENV.AUTH_TOKEN || 'test';
const HEADERS = { 'Authorization': `Bearer ${TOKEN}`, 'Accept': 'application/json' };

export default function () {
  const e = http.get(`${BASE}/v1/engagements?limit=20`, { headers: HEADERS, tags: { name: 'engagements' } });
  engagementListLatency.add(e.timings.duration);
  check(e, { 'engagements 2xx': (r) => r.status >= 200 && r.status < 300 });

  const f = http.get(`${BASE}/v1/findings?limit=50`, { headers: HEADERS, tags: { name: 'findings' } });
  findingListLatency.add(f.timings.duration);
  check(f, { 'findings 2xx': (r) => r.status >= 200 && r.status < 300 });
}

export function handleSummary(data) {
  return { 'summary-api-baseline.json': JSON.stringify(data, null, 2) };
}
