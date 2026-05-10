// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect } from 'vitest';

import { redactString, redactValue } from '../src/redact.js';

describe('PII redaction', () => {
  it('redacts emails', () => {
    const out = redactString('contact alice.smith@example.com today');
    expect(out).toContain('[REDACTED:email]');
    expect(out).not.toContain('alice.smith@example.com');
  });

  it('redacts SSN-like sequences', () => {
    const out = redactString('SSN 123-45-6789 was leaked');
    expect(out).toContain('[REDACTED:ssn]');
    expect(out).not.toContain('123-45-6789');
  });

  it('redacts credit-card-like sequences', () => {
    const out = redactString('paid with 4111 1111 1111 1111');
    expect(out).toContain('[REDACTED:cc]');
    expect(out).not.toMatch(/4111\s?1111\s?1111\s?1111/);
  });

  it('redacts JWT tokens', () => {
    const out = redactString('Bearer eyJhbGciOiJIUzI1NiJ9.payloadpayload.sigsigsig');
    expect(out).not.toContain('eyJhbGciOiJIUzI1NiJ9');
  });

  it('redacts AWS access keys', () => {
    const out = redactString('key=AKIAIOSFODNN7EXAMPLE in env');
    expect(out).toContain('[REDACTED:aws_key]');
    expect(out).not.toContain('AKIAIOSFODNN7EXAMPLE');
  });

  it('redacts phone numbers', () => {
    const out = redactString('call +1 415 555 0142 now');
    expect(out).toContain('[REDACTED:phone]');
  });

  it('redacts IPv4 addresses', () => {
    const out = redactString('client_ip=192.168.0.42 routed');
    expect(out).toContain('[REDACTED:ipv4]');
    expect(out).not.toContain('192.168.0.42');
  });

  it('walks nested objects without infinite recursion', () => {
    const input = {
      user: { email: 'bob@example.com', other: 'safe' },
      list: ['nick@x.io', { ssn: '123-45-6789' }],
    };
    const out = redactValue(input);
    expect(JSON.stringify(out)).not.toContain('bob@example.com');
    expect(JSON.stringify(out)).not.toContain('nick@x.io');
    expect(JSON.stringify(out)).not.toContain('123-45-6789');
  });

  it('passes through primitives unchanged', () => {
    expect(redactValue(42)).toBe(42);
    expect(redactValue(null)).toBe(null);
    expect(redactValue(true)).toBe(true);
  });

  it('respects maxDepth', () => {
    const deep = { a: { b: { c: 'eve@z.com' } } };
    const limited = redactValue(deep, { maxDepth: 1 });
    const limitedJson = JSON.stringify(limited);
    expect(limitedJson).toContain('eve@z.com');
  });
});
