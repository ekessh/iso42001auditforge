// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { computeMerkleRoot, bundleManifestRoot, leafHash } from '../src/merkle.js';

describe('merkle', () => {
  it('produces stable root for sorted leaves', () => {
    const r1 = computeMerkleRoot(['a', 'b', 'c', 'd']);
    expect(r1).toMatch(/^[a-f0-9]{64}$/);
    const r2 = computeMerkleRoot(['a', 'b', 'c', 'd']);
    expect(r1).toBe(r2);
  });
  it('odd leaf count', () => {
    expect(() => computeMerkleRoot(['x', 'y', 'z'])).not.toThrow();
  });
  it('bundle manifest root order-insensitive', () => {
    const a = bundleManifestRoot([{ path: 'p1', hash: leafHash('A') }, { path: 'p2', hash: leafHash('B') }]);
    const b = bundleManifestRoot([{ path: 'p2', hash: leafHash('B') }, { path: 'p1', hash: leafHash('A') }]);
    expect(a).toBe(b);
  });
  it('bundle manifest changes on mutation', () => {
    const a = bundleManifestRoot([{ path: 'p1', hash: leafHash('A') }]);
    const b = bundleManifestRoot([{ path: 'p1', hash: leafHash('A!') }]);
    expect(a).not.toBe(b);
  });
});
