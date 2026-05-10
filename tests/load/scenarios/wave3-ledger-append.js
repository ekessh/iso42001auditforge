// SPDX-License-Identifier: BUSL-1.1
// k6 high-rate ledger appends. p99 < 50ms target. After the run, the chain
// integrity is verified by packages/audit-engine/ChainVerifier (separate
// post-test step in CI).
import http from 'k6/http';
import { check } from 'k6';
import { Trend, Counter } from 'k6/metrics';

const appendLatency = new Trend('ledger_append_ms', true);
const appendErrors = new Counter('ledger_append_errors');

export const options = {
  scenarios: {
    append: {
      executor: 'constant-arrival-rate',
      rate: 200,
      timeUnit: '1s',
      duration: '3m',
      preAllocatedVUs: 100,
      maxVUs: 200,
    },
  },
  thresholds: {
    'ledger_append_ms': ['p(99)<50'],
    'http_req_failed': ['rate<0.005'],
    'ledger_append_errors': ['count<10'],
  },
};

const BASE = __ENV.API_URL || 'http://localhost:3001';
const TOKEN = __ENV.AUTH_TOKEN || 'test';
const ENGAGEMENT_ID = __ENV.ENGAGEMENT_ID || 'load-test-engagement';
const HEADERS = { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

export default function () {
  const start = Date.now();
  const r = http.post(
    `${BASE}/v1/audit-ledger/append`,
    JSON.stringify({
      engagementId: ENGAGEMENT_ID,
      type: 'load.synthetic',
      payload: { vu: __VU, iter: __ITER, ts: start },
    }),
    { headers: HEADERS },
  );
  appendLatency.add(Date.now() - start);
  if (r.status < 200 || r.status >= 300) appendErrors.add(1);
  check(r, { 'append 2xx': (rr) => rr.status >= 200 && rr.status < 300 });
}

export function handleSummary(data) {
  return { 'summary-ledger-append.json': JSON.stringify(data, null, 2) };
}
