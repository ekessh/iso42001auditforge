// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { TokenBucketRateLimiter, type Clock } from '../src/rate-limit.js';
import { ConfigurationError } from '@auditforge/shared';

class FakeClock implements Clock {
  ms = 0;
  nowMs(): number {
    return this.ms;
  }
}

describe('TokenBucketRateLimiter — config', () => {
  it('rejects invalid capacity', () => {
    const r = new TokenBucketRateLimiter();
    expect(() => r.configure('t', { capacity: 0, refillPerSecond: 1 })).toThrow(
      ConfigurationError,
    );
  });

  it('rejects negative refill', () => {
    const r = new TokenBucketRateLimiter();
    expect(() => r.configure('t', { capacity: 5, refillPerSecond: -1 })).toThrow(
      ConfigurationError,
    );
  });

  it('throws when consuming for unconfigured tenant', () => {
    const r = new TokenBucketRateLimiter();
    expect(() => r.consume('nope')).toThrow(ConfigurationError);
  });
});

describe('TokenBucketRateLimiter — burst & refill', () => {
  it('allows burst up to capacity then denies', () => {
    const clock = new FakeClock();
    const r = new TokenBucketRateLimiter(clock);
    r.configure('t', { capacity: 3, refillPerSecond: 1 });
    expect(r.consume('t')).toBe(true);
    expect(r.consume('t')).toBe(true);
    expect(r.consume('t')).toBe(true);
    expect(r.consume('t')).toBe(false);
  });

  it('refills tokens linearly over time', () => {
    const clock = new FakeClock();
    const r = new TokenBucketRateLimiter(clock);
    r.configure('t', { capacity: 5, refillPerSecond: 2 });
    // drain
    for (let i = 0; i < 5; i++) r.consume('t');
    expect(r.consume('t')).toBe(false);
    // 1.5 seconds -> 3 tokens
    clock.ms = 1500;
    expect(r.consume('t')).toBe(true);
    expect(r.consume('t')).toBe(true);
    expect(r.consume('t')).toBe(true);
    expect(r.consume('t')).toBe(false);
  });

  it('clamps tokens to capacity', () => {
    const clock = new FakeClock();
    const r = new TokenBucketRateLimiter(clock);
    r.configure('t', { capacity: 4, refillPerSecond: 100 });
    clock.ms = 60_000;
    expect(r.peek('t')).toBeLessThanOrEqual(4);
  });

  it('isolates tenants', () => {
    const clock = new FakeClock();
    const r = new TokenBucketRateLimiter(clock);
    r.configure('a', { capacity: 1, refillPerSecond: 0 });
    r.configure('b', { capacity: 1, refillPerSecond: 0 });
    expect(r.consume('a')).toBe(true);
    expect(r.consume('b')).toBe(true);
    expect(r.consume('a')).toBe(false);
    expect(r.consume('b')).toBe(false);
  });

  it('reconfigure caps current tokens to new capacity', () => {
    const clock = new FakeClock();
    const r = new TokenBucketRateLimiter(clock);
    r.configure('t', { capacity: 10, refillPerSecond: 0 });
    expect(r.peek('t')).toBe(10);
    r.configure('t', { capacity: 3, refillPerSecond: 0 });
    expect(r.peek('t')).toBe(3);
  });
});
