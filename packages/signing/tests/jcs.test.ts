// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { canonicalize } from '../src/jcs.js';

describe('JCS canonicalize', () => {
  it('sorts object keys by UTF-16 codepoint', () => {
    expect(canonicalize({ b: 1, a: 2, B: 3 })).toBe('{"B":3,"a":2,"b":1}');
  });

  it('emits arrays in source order', () => {
    expect(canonicalize([3, 1, 2])).toBe('[3,1,2]');
  });

  it('quotes only required string chars', () => {
    expect(canonicalize('hello "world"\n')).toBe('"hello \\"world\\"\\n"');
  });

  it('emits booleans and null', () => {
    expect(canonicalize({ a: true, b: false, c: null })).toBe('{"a":true,"b":false,"c":null}');
  });

  it('emits 0 as plain 0', () => {
    expect(canonicalize(0)).toBe('0');
  });

  it('passes through nested structures stably', () => {
    const v = { z: [1, { y: 2, x: 3 }], a: 'a' };
    expect(canonicalize(v)).toBe('{"a":"a","z":[1,{"x":3,"y":2}]}');
  });

  it('rejects NaN/Infinity', () => {
    expect(() => canonicalize(NaN)).toThrow();
    expect(() => canonicalize(Infinity)).toThrow();
  });

  it('escapes control characters', () => {
    expect(canonicalize('')).toBe('"\\u0001"');
  });

  it('treats two equivalent objects identically', () => {
    expect(canonicalize({ a: 1, b: 2 })).toBe(canonicalize({ b: 2, a: 1 }));
  });

  it('skips undefined values in objects', () => {
    expect(canonicalize({ a: 1, b: undefined as unknown as null, c: 3 })).toBe('{"a":1,"c":3}');
  });
});
