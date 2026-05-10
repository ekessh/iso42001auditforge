// SPDX-License-Identifier: BUSL-1.1
// k6 LLM tier router: drive synthetic prompt classes; assert router selects
// expected tier and report p99 latency by tier.
import http from 'k6/http';
import { check } from 'k6';
import { Trend, Counter } from 'k6/metrics';

const tierLatency = {
  small: new Trend('tier_small_ms', true),
  medium: new Trend('tier_medium_ms', true),
  large: new Trend('tier_large_ms', true),
  reasoning: new Trend('tier_reasoning_ms', true),
};

const tierMismatch = new Counter('tier_mismatch_total');

export const options = {
  scenarios: {
    routing: {
      executor: 'ramping-arrival-rate',
      startRate: 5,
      timeUnit: '1s',
      preAllocatedVUs: 30,
      stages: [
        { target: 20, duration: '1m' },
        { target: 50, duration: '2m' },
        { target: 5, duration: '1m' },
      ],
    },
  },
  thresholds: {
    'http_req_failed': ['rate<0.02'],
    'tier_small_ms': ['p(99)<800'],
    'tier_medium_ms': ['p(99)<2500'],
    'tier_large_ms': ['p(99)<6000'],
    'tier_reasoning_ms': ['p(99)<12000'],
    'tier_mismatch_total': ['count<5'],
  },
};

const BASE = __ENV.API_URL || 'http://localhost:3001';
const TOKEN = __ENV.AUTH_TOKEN || 'test';
const HEADERS = { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

const PROMPT_CLASSES = [
  { callSite: 'extractor.entityType', expectedTier: 'small', payload: { text: 'Acme Corp deployed a recommender model on 2025-04-12.' } },
  { callSite: 'reranker.rank', expectedTier: 'medium', payload: { query: 'data governance', candidates: ['c1', 'c2', 'c3'] } },
  { callSite: 'ncDrafter.synthesize', expectedTier: 'medium', payload: { findingId: 'cf-1' } },
  { callSite: 'crossEngagement.synth', expectedTier: 'large', payload: { engagementIds: ['e1', 'e2'] } },
  { callSite: 'attribution.highStakes', expectedTier: 'reasoning', payload: { claimId: 'cl-1' } },
];

export default function () {
  const cls = PROMPT_CLASSES[Math.floor(Math.random() * PROMPT_CLASSES.length)];
  const r = http.post(
    `${BASE}/v1/llm/route-and-invoke`,
    JSON.stringify({ callSite: cls.callSite, payload: cls.payload }),
    { headers: HEADERS, tags: { tier: cls.expectedTier } },
  );
  const body = r.json();
  if (r.status === 200 && body && body.tier) {
    tierLatency[body.tier]?.add(r.timings.duration);
    if (body.tier !== cls.expectedTier) tierMismatch.add(1);
  }
  check(r, { 'invoke 2xx': (rr) => rr.status >= 200 && rr.status < 300 });
}

export function handleSummary(data) {
  return { 'summary-llm-tier-routing.json': JSON.stringify(data, null, 2) };
}
