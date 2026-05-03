// SPDX-License-Identifier: BUSL-1.1
import { signRequest, type SignedRequestHeaders } from '../src/signing.js';
import type { TelemetryPayload, TelemetryStream } from '../src/domain.js';

export const TENANT = 'tenant_abc';
export const STREAM = 'stream_eng_001';
export const SECRET = 'super-secret-32-byte-value!!!!XX';

export function makeStream(overrides: Partial<TelemetryStream> = {}): TelemetryStream {
  return {
    streamId: STREAM,
    tenantId: TENANT,
    engagementId: 'eng_001',
    name: 'engagement-001-stream',
    secretId: 'sec1',
    rateLimit: { capacity: 5, refillPerSecond: 1 },
    replayWindowSeconds: 300,
    status: 'active',
    createdAt: '2026-05-01T00:00:00.000Z',
    ...overrides,
  };
}

let payloadCounter = 0;
export function nextPayloadId(): string {
  payloadCounter += 1;
  return `pl_${payloadCounter.toString(36)}_${Date.now()}`;
}

export function makePayload(
  partial: Partial<TelemetryPayload> & { metric?: TelemetryPayload['metric'] } = {},
): TelemetryPayload {
  return {
    id: partial.id ?? nextPayloadId(),
    tenantId: partial.tenantId ?? TENANT,
    streamId: partial.streamId ?? STREAM,
    occurredAt: partial.occurredAt ?? '2026-05-03T12:00:00.000Z',
    metric:
      partial.metric ??
      ({
        type: 'probe_rollup',
        probeId: 'pr_a',
        windowSeconds: 3600,
        runs: 100,
        passes: 95,
        failures: 5,
        passRate: 0.95,
      } as const),
  };
}

export function signed(
  body: string,
  opts: {
    tenantId?: string;
    streamId?: string;
    timestamp?: number;
    nonce?: string;
    secret?: string;
  } = {},
): { headers: SignedRequestHeaders; body: string } {
  const tenantId = opts.tenantId ?? TENANT;
  const streamId = opts.streamId ?? STREAM;
  const timestamp = opts.timestamp ?? Math.floor(Date.now() / 1000);
  const nonce = opts.nonce ?? `n_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
  const secret = opts.secret ?? SECRET;
  const signature = signRequest({ tenantId, streamId, timestamp, nonce, body, secret });
  return {
    headers: { tenantId, streamId, timestamp, nonce, signature },
    body,
  };
}
