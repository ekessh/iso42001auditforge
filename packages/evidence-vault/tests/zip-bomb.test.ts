// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { evaluateZip, DEFAULT_POLICY } from '../src/zip-bomb-defense.js';

describe('zip-bomb defense', () => {
  it('accepts normal zip', () => {
    expect(evaluateZip([{ compressedSize: 1000, uncompressedSize: 5000 }]).ok).toBe(true);
  });
  it('rejects high ratio', () => {
    expect(evaluateZip([{ compressedSize: 100, uncompressedSize: 100_000_000 }]).ok).toBe(false);
  });
  it('rejects too many entries', () => {
    const entries = Array.from({ length: 20_000 }, () => ({ compressedSize: 1, uncompressedSize: 1 }));
    expect(evaluateZip(entries).ok).toBe(false);
  });
  it('rejects oversize uncompressed', () => {
    expect(evaluateZip([{ compressedSize: 1_000_000, uncompressedSize: DEFAULT_POLICY.maxUncompressedBytes + 1 }]).ok).toBe(false);
  });
});
