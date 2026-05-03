// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { hashBoth, verifyHash } from '../../../packages/evidence-vault/src/hashing.js';

describe('signature tamper detection', () => {
  it('detects single-byte mutation', () => {
    const original = new TextEncoder().encode('signed audit file v1');
    const expected = hashBoth(original);
    const mutated = new Uint8Array(original);
    mutated[0]! ^= 1;
    expect(verifyHash(mutated, expected)).toBe(false);
  });
  it('detects truncation', () => {
    const original = new TextEncoder().encode('full content');
    const expected = hashBoth(original);
    const truncated = original.slice(0, original.length - 1);
    expect(verifyHash(truncated, expected)).toBe(false);
  });
  it('detects appended data', () => {
    const original = new TextEncoder().encode('content');
    const expected = hashBoth(original);
    const appended = new Uint8Array([...original, 0x21]);
    expect(verifyHash(appended, expected)).toBe(false);
  });
});
