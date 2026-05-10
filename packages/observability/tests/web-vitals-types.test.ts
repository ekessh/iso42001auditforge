// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect } from 'vitest';

import {
  webVitalSampleSchema,
  webVitalsBatchSchema,
  observabilityErrorSchema,
  observabilityErrorsBatchSchema,
} from '../src/web-vitals-types.js';

describe('web-vitals wire types', () => {
  it('accepts a valid sample', () => {
    const ok = webVitalSampleSchema.parse({
      name: 'LCP',
      value: 1234.5,
      rating: 'good',
      id: 'v1-x',
      pageUrl: 'https://example.com/dashboard',
      pagePath: '/dashboard',
      occurredAt: new Date().toISOString(),
    });
    expect(ok.name).toBe('LCP');
  });

  it('rejects negative web-vital values', () => {
    expect(() =>
      webVitalSampleSchema.parse({
        name: 'LCP',
        value: -1,
        rating: 'good',
        id: 'v1-x',
        pageUrl: 'https://example.com/',
        pagePath: '/',
        occurredAt: new Date().toISOString(),
      }),
    ).toThrow();
  });

  it('rejects invalid name', () => {
    expect(() =>
      webVitalSampleSchema.parse({
        name: 'NOPE',
        value: 1,
        rating: 'good',
        id: 'v1-x',
        pageUrl: 'https://example.com/',
        pagePath: '/',
        occurredAt: new Date().toISOString(),
      }),
    ).toThrow();
  });

  it('caps batch size', () => {
    const samples = Array.from({ length: 65 }, (_, i) => ({
      name: 'LCP' as const,
      value: 100 + i,
      rating: 'good' as const,
      id: `v-${i}`,
      pageUrl: 'https://x/',
      pagePath: '/',
      occurredAt: new Date().toISOString(),
    }));
    expect(() => webVitalsBatchSchema.parse({ samples })).toThrow();
  });

  it('observability error schema requires message + url + path', () => {
    const ok = observabilityErrorSchema.parse({
      message: 'Cannot read properties of undefined',
      pageUrl: 'https://example.com/',
      pagePath: '/',
      occurredAt: new Date().toISOString(),
    });
    expect(ok.severity).toBe('error');
  });

  it('observability error batch enforces upper bound', () => {
    const errors = Array.from({ length: 33 }, () => ({
      message: 'oops',
      pageUrl: 'https://example.com/',
      pagePath: '/',
      occurredAt: new Date().toISOString(),
    }));
    expect(() => observabilityErrorsBatchSchema.parse({ errors })).toThrow();
  });
});
