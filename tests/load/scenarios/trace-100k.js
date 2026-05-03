// SPDX-License-Identifier: BUSL-1.1
import http from 'k6/http';
import { check } from 'k6';

export const options = { vus: 1, iterations: 1, thresholds: { http_req_duration: ['p(95)<10000'] } };

const BASE = __ENV.API_URL || 'http://localhost:4000';

function buildTrace(spanCount) {
  const spans = [];
  for (let i = 0; i < spanCount; i++) {
    spans.push({ spanId: `s-${i}`, parentSpanId: i > 0 ? `s-${i - 1}` : null, name: `op-${i}`, startNs: i * 1000, endNs: (i + 1) * 1000, attributes: {}, status: 'OK' });
  }
  return { traceId: 'large-trace', spans };
}

export default function () {
  const trace = buildTrace(100_000);
  const r = http.post(`${BASE}/traces/ingest`, JSON.stringify(trace), { headers: { 'Content-Type': 'application/json' } });
  check(r, { 'ingested': (r) => r.status === 202 || r.status === 401 });
}
