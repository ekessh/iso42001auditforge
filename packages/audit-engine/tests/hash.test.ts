// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { canonicalJsonStringify, computeChainHash, sha256Hex, GENESIS_HASH } from '../src/hash.js';

describe('hash utilities', () => {
  it('canonicalJsonStringify sorts keys deterministically', () => {
    const a = canonicalJsonStringify({ b: 1, a: 2 });
    const b = canonicalJsonStringify({ a: 2, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":2,"b":1}');
  });

  it('canonicalJsonStringify recurses into nested objects + arrays', () => {
    const v = canonicalJsonStringify({ z: [{ b: 2, a: 1 }], a: 'x' });
    expect(v).toBe('{"a":"x","z":[{"a":1,"b":2}]}');
  });

  it('sha256Hex returns 64 lowercase hex chars', () => {
    const h = sha256Hex('hello');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('property: canonical encoding is invariant to key order', () => {
    fc.assert(
      fc.property(
        fc.dictionary(fc.string({ minLength: 1, maxLength: 8 }), fc.integer()),
        (obj) => {
          const a = canonicalJsonStringify(obj);
          const shuffled: Record<string, number> = {};
          for (const k of Object.keys(obj).sort().reverse()) shuffled[k] = obj[k]!;
          const b = canonicalJsonStringify(shuffled);
          expect(a).toBe(b);
        },
      ),
    );
  });

  it('computeChainHash differs when prev or payload changes', () => {
    const a = computeChainHash(GENESIS_HASH, '{}', '{}');
    const b = computeChainHash(GENESIS_HASH, '{"x":1}', '{}');
    const c = computeChainHash('a'.repeat(64), '{}', '{}');
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it('GENESIS_HASH is 64 zeros', () => {
    expect(GENESIS_HASH).toBe('0'.repeat(64));
  });
});
