// SPDX-License-Identifier: BUSL-1.1
import {
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  type Result,
  ok,
  err,
} from '@auditforge/shared';
import {
  telemetryPayloadSchema,
  type TelemetryPayload,
  type TelemetryStream,
} from './domain.js';
import {
  type NonceStore,
  type SignedRequestHeaders,
  verifyRequest,
  InMemoryNonceStore,
} from './signing.js';
import type { TokenBucketRateLimiter } from './rate-limit.js';

/**
 * Hardened telemetry ingest pipeline:
 *
 *   1. Resolve stream + verify it is `active` (with consent).
 *   2. Verify HMAC signature + replay window + nonce uniqueness.
 *   3. Per-tenant token-bucket rate limit.
 *   4. Strict JSON parse + Zod validation.
 *   5. Idempotent dedup by `(tenantId, payload.id)`.
 *
 * The ingest is **transport-agnostic**: callers feed the raw body string +
 * structured headers. Failures map to `AuditForgeError` subclasses.
 */

export type RejectReason =
  | 'stream_unknown'
  | 'stream_not_active'
  | 'tenant_mismatch'
  | 'signature_invalid'
  | 'replay_detected'
  | 'rate_limited'
  | 'malformed_json'
  | 'schema_invalid'
  | 'duplicate_payload';

export interface RejectInfo {
  reason: RejectReason;
  message: string;
  details?: Record<string, unknown> | undefined;
}

export interface AcceptInfo {
  payload: TelemetryPayload;
  duplicate: false;
}

export interface DuplicateInfo {
  payload: TelemetryPayload;
  duplicate: true;
}

export type IngestResult = Result<AcceptInfo | DuplicateInfo, RejectInfo>;

export interface SecretResolver {
  /** Resolve the per-tenant signing secret given the stream's secretId. */
  resolve(secretId: string): Promise<string> | string;
}

export interface DedupStore {
  /**
   * Returns true iff `(tenantId, payloadId)` was newly recorded
   * (i.e., not already seen).
   */
  recordIfNew(tenantId: string, payloadId: string): boolean;
  size(): number;
}

export class InMemoryDedupStore implements DedupStore {
  private readonly seen = new Set<string>();
  recordIfNew(tenantId: string, payloadId: string): boolean {
    const k = `${tenantId} ${payloadId}`;
    if (this.seen.has(k)) return false;
    this.seen.add(k);
    return true;
  }
  size(): number {
    return this.seen.size;
  }
}

export interface StreamRegistry {
  get(streamId: string): TelemetryStream | undefined;
}

export class InMemoryStreamRegistry implements StreamRegistry {
  private readonly streams = new Map<string, TelemetryStream>();
  put(stream: TelemetryStream): void {
    this.streams.set(stream.streamId, stream);
  }
  get(streamId: string): TelemetryStream | undefined {
    return this.streams.get(streamId);
  }
  delete(streamId: string): void {
    this.streams.delete(streamId);
  }
  size(): number {
    return this.streams.size;
  }
}

export interface TelemetryIngestOptions {
  registry: StreamRegistry;
  secrets: SecretResolver;
  rateLimiter: TokenBucketRateLimiter;
  nonceStore?: NonceStore;
  dedupStore?: DedupStore;
  /** Override `now` for deterministic tests. */
  nowEpochSec?: () => number;
  /** Optional event sink for accepted payloads. */
  onAccept?: (payload: TelemetryPayload) => void;
}

const MAX_BODY_BYTES = 64 * 1024;

export class TelemetryIngest {
  private readonly registry: StreamRegistry;
  private readonly secrets: SecretResolver;
  private readonly rateLimiter: TokenBucketRateLimiter;
  private readonly nonceStore: NonceStore;
  private readonly dedupStore: DedupStore;
  private readonly now: () => number;
  private readonly onAccept: ((p: TelemetryPayload) => void) | undefined;

  constructor(opts: TelemetryIngestOptions) {
    this.registry = opts.registry;
    this.secrets = opts.secrets;
    this.rateLimiter = opts.rateLimiter;
    this.nonceStore = opts.nonceStore ?? new InMemoryNonceStore();
    this.dedupStore = opts.dedupStore ?? new InMemoryDedupStore();
    this.now = opts.nowEpochSec ?? (() => Math.floor(Date.now() / 1000));
    this.onAccept = opts.onAccept;
  }

  async ingest(headers: SignedRequestHeaders, body: string): Promise<IngestResult> {
    // Body size guard — protects JSON.parse and Zod from oversized inputs.
    if (typeof body !== 'string') {
      return err({ reason: 'malformed_json', message: 'body must be a string' });
    }
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
      return err({ reason: 'malformed_json', message: 'body too large' });
    }

    // 1. Stream lookup
    const stream = this.registry.get(headers.streamId);
    if (!stream) {
      return err({
        reason: 'stream_unknown',
        message: 'stream not registered',
        details: { streamId: headers.streamId },
      });
    }

    // Tenant binding — header tenant must match registered stream's tenant.
    if (stream.tenantId !== headers.tenantId) {
      return err({
        reason: 'tenant_mismatch',
        message: 'tenant does not match stream',
      });
    }

    if (stream.status !== 'active') {
      return err({
        reason: 'stream_not_active',
        message: `stream status is ${stream.status}`,
      });
    }

    // 2. Signature + replay verification
    const secret = await this.secrets.resolve(stream.secretId);
    try {
      verifyRequest(headers, body, {
        secret,
        replayWindowSeconds: stream.replayWindowSeconds,
        expectedTenantId: stream.tenantId,
        nonceStore: this.nonceStore,
        nowEpochSec: this.now(),
      });
    } catch (e) {
      if (e instanceof AuthenticationError) {
        const message = e.message;
        const reason: RejectReason = message.includes('replay')
          ? 'replay_detected'
          : 'signature_invalid';
        return err({ reason, message, details: e.details });
      }
      throw e;
    }

    // 3. Rate limit
    if (!this.rateLimiter.has(stream.tenantId)) {
      this.rateLimiter.configure(stream.tenantId, stream.rateLimit);
    }
    if (!this.rateLimiter.consume(stream.tenantId, 1)) {
      return err({ reason: 'rate_limited', message: 'rate limit exceeded' });
    }

    // 4. Parse + schema validate (strict)
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch (e) {
      return err({
        reason: 'malformed_json',
        message: 'JSON parse failed',
        details: { error: (e as Error).message },
      });
    }

    const validation = telemetryPayloadSchema.safeParse(parsed);
    if (!validation.success) {
      return err({
        reason: 'schema_invalid',
        message: 'schema validation failed',
        details: { issues: validation.error.issues.slice(0, 16) },
      });
    }

    const payload = validation.data;

    // Cross-check: payload tenant/stream must match headers.
    if (payload.tenantId !== headers.tenantId) {
      return err({
        reason: 'tenant_mismatch',
        message: 'payload tenantId differs from header',
      });
    }
    if (payload.streamId !== headers.streamId) {
      return err({
        reason: 'schema_invalid',
        message: 'payload streamId differs from header',
      });
    }

    // 5. Idempotent dedup
    const fresh = this.dedupStore.recordIfNew(payload.tenantId, payload.id);
    if (!fresh) {
      return ok({ payload, duplicate: true });
    }

    if (this.onAccept) this.onAccept(payload);
    return ok({ payload, duplicate: false });
  }
}

/** Convenience: build a test fixture stream + helper to emit a signed request. */
export function unsupportedAccess(action: string): never {
  throw new AuthorizationError(action);
}

export { ValidationError };
