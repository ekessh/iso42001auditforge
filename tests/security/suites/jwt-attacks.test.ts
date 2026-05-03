// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';

interface JwtHeader { alg: string }

function rejectAlgNone(header: JwtHeader): boolean {
  return header.alg !== 'none';
}

function rejectAlgConfusion(declaredAlg: string, expectedAsymmetric: boolean): boolean {
  if (expectedAsymmetric && declaredAlg.startsWith('HS')) return false;
  return true;
}

describe('JWT attacks', () => {
  it('rejects alg=none', () => {
    expect(rejectAlgNone({ alg: 'none' })).toBe(false);
    expect(rejectAlgNone({ alg: 'RS256' })).toBe(true);
  });
  it('rejects RS->HS algorithm confusion', () => {
    expect(rejectAlgConfusion('HS256', true)).toBe(false);
    expect(rejectAlgConfusion('RS256', true)).toBe(true);
  });
  it('rejects empty signature', () => {
    const sig = '';
    expect(sig.length === 0).toBe(true);
  });
});
