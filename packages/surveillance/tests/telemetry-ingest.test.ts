// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import {
  TelemetryIngest,
  InMemoryDedupStore,
  InMemoryStreamRegistry,
} from '../src/telemetry-ingest.js';
import { TokenBucketRateLimiter } from '../src/rate-limit.js';
import { InMemoryNonceStore } from '../src/signing.js';
import { makePayload, makeStream, signed, SECRET, TENANT, STREAM } from './helpers.js';

function setup() {
  const registry = new InMemoryStreamRegistry();
  registry.put(makeStream());
  const rateLimiter = new TokenBucketRateLimiter();
  const dedupStore = new InMemoryDedupStore();
  const nonceStore = new InMemoryNonceStore();
  const ingest = new TelemetryIngest({
    registry,
    secrets: { resolve: () => SECRET },
    rateLimiter,
    dedupStore,
    nonceStore,
  });
  return { registry, rateLimiter, ingest, dedupStore, nonceStore };
}

describe('TelemetryIngest — happy path', () => {
  it('accepts a valid signed payload', async () => {
    const { ingest } = setup();
    const payload = makePayload();
    const { headers, body } = signed(JSON.stringify(payload));
    const result = await ingest.ingest(headers, body);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.duplicate).toBe(false);
  });

  it('flags duplicate payload ids', async () => {
    const { ingest } = setup();
    const payload = makePayload({ id: 'fixed-id-1' });
    {
      const { headers, body } = signed(JSON.stringify(payload));
      await ingest.ingest(headers, body);
    }
    const { headers, body } = signed(JSON.stringify(payload));
    const result2 = await ingest.ingest(headers, body);
    expect(result2.ok).toBe(true);
    if (result2.ok) expect(result2.value.duplicate).toBe(true);
  });
});

describe('TelemetryIngest — replay attack', () => {
  it('rejects nonce reuse', async () => {
    const { ingest } = setup();
    const payload1 = makePayload();
    const ts = Math.floor(Date.now() / 1000);
    const nonce = 'replay-nonce-12345';
    const { headers: h1, body: b1 } = signed(JSON.stringify(payload1), { nonce, timestamp: ts });
    const ok1 = await ingest.ingest(h1, b1);
    expect(ok1.ok).toBe(true);

    const payload2 = makePayload({ id: 'different-id' });
    const { headers: h2, body: b2 } = signed(JSON.stringify(payload2), { nonce, timestamp: ts });
    const ok2 = await ingest.ingest(h2, b2);
    expect(ok2.ok).toBe(false);
    if (!ok2.ok) expect(ok2.error.reason).toBe('replay_detected');
  });
});

describe('TelemetryIngest — signature checks', () => {
  it('rejects invalid signature', async () => {
    const { ingest } = setup();
    const payload = makePayload();
    const { headers, body } = signed(JSON.stringify(payload));
    headers.signature = 'a'.repeat(64);
    const result = await ingest.ingest(headers, body);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.reason).toBe('signature_invalid');
  });

  it('rejects body tampering', async () => {
    const { ingest } = setup();
    const payload = makePayload();
    const { headers } = signed(JSON.stringify(payload));
    const tamperedBody = JSON.stringify({ ...payload, id: 'evil' });
    const result = await ingest.ingest(headers, tamperedBody);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.reason).toBe('signature_invalid');
  });

  it('rejects mismatched stream registration', async () => {
    const { ingest } = setup();
    const payload = makePayload();
    const { headers, body } = signed(JSON.stringify(payload), { streamId: 'unknown' });
    const result = await ingest.ingest(headers, body);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.reason).toBe('stream_unknown');
  });

  it('rejects when stream is paused', async () => {
    const registry = new InMemoryStreamRegistry();
    registry.put(makeStream({ status: 'paused' }));
    const ingest = new TelemetryIngest({
      registry,
      secrets: { resolve: () => SECRET },
      rateLimiter: new TokenBucketRateLimiter(),
    });
    const payload = makePayload();
    const { headers, body } = signed(JSON.stringify(payload));
    const result = await ingest.ingest(headers, body);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.reason).toBe('stream_not_active');
  });

  it('rejects tenant mismatch in payload body', async () => {
    const { ingest } = setup();
    const payload = makePayload({ tenantId: 'other-tenant' });
    const { headers, body } = signed(JSON.stringify(payload));
    const result = await ingest.ingest(headers, body);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.reason).toBe('schema_invalid');
    // Note: payload still strict-validates fine, but tenantId mismatch
    // could surface as either schema_invalid (wrong streamId) or tenant_mismatch.
  });
});

describe('TelemetryIngest — schema fuzz', () => {
  const malformed: unknown[] = [
    null,
    [],
    'not json',
    { id: '', tenantId: TENANT, streamId: STREAM, occurredAt: '2026-05-03T12:00:00Z', metric: { type: 'probe_rollup' } },
    { id: 'x', tenantId: TENANT, streamId: STREAM, occurredAt: 'not-a-date', metric: { type: 'latency', quantile: 'p50', valueMs: 1, sampleSize: 1 } },
    { id: 'x', tenantId: TENANT, streamId: STREAM, occurredAt: '2026-05-03T12:00:00Z', metric: { type: 'latency', quantile: 'p99.9', valueMs: 1, sampleSize: 1 } },
    { id: 'x', tenantId: TENANT, streamId: STREAM, occurredAt: '2026-05-03T12:00:00Z', metric: { type: 'unknown', x: 1 } },
    { id: 'x', tenantId: TENANT, streamId: STREAM, occurredAt: '2026-05-03T12:00:00Z', metric: { type: 'probe_rollup', probeId: 'p', windowSeconds: -1, runs: 1, passes: 1, failures: 0, passRate: 1 } },
    { id: 'x', tenantId: TENANT, streamId: STREAM, occurredAt: '2026-05-03T12:00:00Z', metric: { type: 'probe_rollup', probeId: 'p', windowSeconds: 60, runs: 1, passes: 5, failures: 0, passRate: 1 } },
    // extra-keys forbidden by strict()
    { id: 'x', tenantId: TENANT, streamId: STREAM, occurredAt: '2026-05-03T12:00:00Z', metric: { type: 'availability', windowSeconds: 60, uptime: 1 }, extra: 1 },
    // probability out of range
    { id: 'x', tenantId: TENANT, streamId: STREAM, occurredAt: '2026-05-03T12:00:00Z', metric: { type: 'availability', windowSeconds: 60, uptime: 1.2 } },
  ];

  for (const [i, m] of malformed.entries()) {
    it(`rejects malformed payload #${i} without crashing`, async () => {
      const { ingest } = setup();
      const body = typeof m === 'string' ? m : JSON.stringify(m);
      const { headers } = signed(body);
      const result = await ingest.ingest(headers, body);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(['schema_invalid', 'malformed_json']).toContain(result.error.reason);
      }
    });
  }

  it('rejects oversized body', async () => {
    const { ingest } = setup();
    const huge = 'x'.repeat(70_000);
    const body = `"${huge}"`;
    const { headers } = signed(body);
    const result = await ingest.ingest(headers, body);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.reason).toBe('malformed_json');
  });

  it('rejects truncated JSON', async () => {
    const { ingest } = setup();
    const body = '{"id":"x"';
    const { headers } = signed(body);
    const result = await ingest.ingest(headers, body);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.reason).toBe('malformed_json');
  });
});

describe('TelemetryIngest — rate limit', () => {
  it('rejects after burst exceeded', async () => {
    const registry = new InMemoryStreamRegistry();
    registry.put(makeStream({ rateLimit: { capacity: 3, refillPerSecond: 0 } }));
    const ingest = new TelemetryIngest({
      registry,
      secrets: { resolve: () => SECRET },
      rateLimiter: new TokenBucketRateLimiter(),
    });
    const results: boolean[] = [];
    for (let i = 0; i < 6; i++) {
      const payload = makePayload({ id: `p_${i}` });
      const { headers, body } = signed(JSON.stringify(payload));
      const r = await ingest.ingest(headers, body);
      results.push(r.ok);
    }
    const accepts = results.filter(Boolean).length;
    expect(accepts).toBe(3);
  });
});

describe('TelemetryIngest — accept callback', () => {
  it('invokes onAccept exactly once per fresh payload', async () => {
    const registry = new InMemoryStreamRegistry();
    registry.put(makeStream());
    const seen: string[] = [];
    const ingest = new TelemetryIngest({
      registry,
      secrets: { resolve: () => SECRET },
      rateLimiter: new TokenBucketRateLimiter(),
      onAccept: (p) => seen.push(p.id),
    });
    const payload = makePayload({ id: 'cb-1' });
    const { headers, body } = signed(JSON.stringify(payload));
    await ingest.ingest(headers, body);
    const dup = signed(JSON.stringify(payload));
    await ingest.ingest(dup.headers, dup.body);
    expect(seen).toEqual(['cb-1']);
  });
});
