// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect } from 'vitest';
import { buildCsp } from './next.config.js';

const TEST_NONCE = 'testnonce123';

describe('buildCsp', () => {
  it('does NOT contain unsafe-inline in script-src', () => {
    const csp = buildCsp(TEST_NONCE);
    // Extract the script-src directive only.
    const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src'));
    expect(scriptSrc).toBeDefined();
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  it('does NOT contain unsafe-eval in script-src', () => {
    const csp = buildCsp(TEST_NONCE);
    const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src'));
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it('contains strict-dynamic in script-src', () => {
    const csp = buildCsp(TEST_NONCE);
    const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src'));
    expect(scriptSrc).toContain("'strict-dynamic'");
  });

  it('embeds the provided nonce in script-src', () => {
    const csp = buildCsp(TEST_NONCE);
    expect(csp).toContain(`'nonce-${TEST_NONCE}'`);
  });

  it('contains frame-ancestors none', () => {
    const csp = buildCsp(TEST_NONCE);
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('contains base-uri self', () => {
    const csp = buildCsp(TEST_NONCE);
    expect(csp).toContain("base-uri 'self'");
  });

  it('contains form-action self', () => {
    const csp = buildCsp(TEST_NONCE);
    expect(csp).toContain("form-action 'self'");
  });

  it('contains object-src none', () => {
    const csp = buildCsp(TEST_NONCE);
    expect(csp).toContain("object-src 'none'");
  });

  it('does not use the same nonce for different calls', () => {
    const a = buildCsp('nonceA');
    const b = buildCsp('nonceB');
    expect(a).toContain("'nonce-nonceA'");
    expect(b).toContain("'nonce-nonceB'");
    expect(a).not.toContain("'nonce-nonceB'");
  });

  it('connect-src references self and configurable API origin', () => {
    const csp = buildCsp(TEST_NONCE);
    const connectSrc = csp.split(';').find((d) => d.trim().startsWith('connect-src'));
    expect(connectSrc).toBeDefined();
    expect(connectSrc).toContain("'self'");
    // Default origin is localhost:4000 when env var is not set.
    expect(connectSrc).toContain('localhost:4000');
  });
});
