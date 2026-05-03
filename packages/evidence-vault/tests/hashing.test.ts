// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { sha256, sha3_256, hashBoth, verifyHash } from '../src/hashing.js';

describe('hashing', () => {
  it('sha256 produces 64 hex chars', () => {
    expect(sha256('hello')).toMatch(/^[a-f0-9]{64}$/);
  });
  it('sha3_256 differs from sha256', () => {
    expect(sha3_256('hello')).not.toBe(sha256('hello'));
  });
  it('verifyHash detects mutation', () => {
    const buf = new TextEncoder().encode('audit-evidence');
    const expected = hashBoth(buf);
    expect(verifyHash(buf, expected)).toBe(true);
    const mutated = new TextEncoder().encode('audit-evidencE');
    expect(verifyHash(mutated, expected)).toBe(false);
  });
});
