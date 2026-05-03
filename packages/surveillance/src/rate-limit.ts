// SPDX-License-Identifier: BUSL-1.1
import { ConfigurationError } from '@auditforge/shared';

/**
 * Per-tenant token-bucket rate limiter.
 *
 * Each tenant has an independent bucket. Buckets refill linearly at
 * `refillPerSecond` up to `capacity`. `consume(tenantId, n)` returns true
 * iff `n` tokens are available (and consumes them). Designed for use in the
 * telemetry ingest hot path.
 */

export interface RateLimitConfig {
  capacity: number;
  refillPerSecond: number;
}

interface BucketState {
  tokens: number;
  lastRefillEpochMs: number;
  config: RateLimitConfig;
}

export interface Clock {
  nowMs(): number;
}

export const systemClock: Clock = { nowMs: () => Date.now() };

export class TokenBucketRateLimiter {
  private readonly buckets = new Map<string, BucketState>();
  private readonly clock: Clock;

  constructor(clock: Clock = systemClock) {
    this.clock = clock;
  }

  configure(tenantId: string, config: RateLimitConfig): void {
    if (!Number.isFinite(config.capacity) || config.capacity <= 0) {
      throw new ConfigurationError('rate-limit capacity must be > 0');
    }
    if (!Number.isFinite(config.refillPerSecond) || config.refillPerSecond < 0) {
      throw new ConfigurationError('rate-limit refillPerSecond must be >= 0');
    }
    const now = this.clock.nowMs();
    const existing = this.buckets.get(tenantId);
    if (existing) {
      existing.config = config;
      existing.tokens = Math.min(existing.tokens, config.capacity);
    } else {
      this.buckets.set(tenantId, {
        tokens: config.capacity,
        lastRefillEpochMs: now,
        config,
      });
    }
  }

  private refill(state: BucketState, nowMs: number): void {
    const elapsedSec = (nowMs - state.lastRefillEpochMs) / 1000;
    if (elapsedSec <= 0) return;
    const add = elapsedSec * state.config.refillPerSecond;
    state.tokens = Math.min(state.config.capacity, state.tokens + add);
    state.lastRefillEpochMs = nowMs;
  }

  /** Returns true iff `cost` tokens were available (and consumed). */
  consume(tenantId: string, cost = 1): boolean {
    const state = this.buckets.get(tenantId);
    if (!state) {
      throw new ConfigurationError('rate-limit not configured for tenant', { tenantId });
    }
    if (cost < 0 || !Number.isFinite(cost)) {
      throw new ConfigurationError('cost must be a non-negative finite number');
    }
    const now = this.clock.nowMs();
    this.refill(state, now);
    if (state.tokens + 1e-9 < cost) {
      return false;
    }
    state.tokens -= cost;
    return true;
  }

  /** Inspect remaining tokens (does not advance the bucket). */
  peek(tenantId: string): number | undefined {
    const state = this.buckets.get(tenantId);
    if (!state) return undefined;
    const now = this.clock.nowMs();
    this.refill(state, now);
    return state.tokens;
  }

  has(tenantId: string): boolean {
    return this.buckets.has(tenantId);
  }
}
