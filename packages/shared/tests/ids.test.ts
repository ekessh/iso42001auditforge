// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { asAuditorId, asClientId, asEngagementId, asFirmId, brandedFromUuid, isUuid } from '../src/ids.js';

const VALID = '550e8400-e29b-41d4-a716-446655440000';

describe('ids', () => {
  it('isUuid accepts canonical v4', () => {
    expect(isUuid(VALID)).toBe(true);
  });

  it('isUuid rejects garbage', () => {
    expect(isUuid('')).toBe(false);
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid('550e8400-e29b-c1d4-a716-446655440000')).toBe(false); // bad version
  });

  it('asFirmId/asAuditorId/asClientId/asEngagementId brand happy path', () => {
    expect(asFirmId(VALID)).toBe(VALID);
    expect(asAuditorId(VALID)).toBe(VALID);
    expect(asClientId(VALID)).toBe(VALID);
    expect(asEngagementId(VALID)).toBe(VALID);
  });

  it('asFirmId throws on invalid', () => {
    expect(() => asFirmId('x')).toThrow(/not a UUID/);
  });

  it('brandedFromUuid throws on invalid', () => {
    expect(() => brandedFromUuid('x')).toThrow();
  });

  it('property: any non-UUID string is rejected', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 50 }), (s) => {
        if (isUuid(s)) return; // skip rare valid hits
        expect(() => asFirmId(s)).toThrow();
      }),
      { numRuns: 200 },
    );
  });
});
