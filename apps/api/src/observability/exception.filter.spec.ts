// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect } from 'vitest';

import { ObservabilityExceptionFilter } from './exception.filter.js';

function host(method = 'GET', url = '/v1/x'): unknown {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ method, url }),
    }),
  };
}

describe('ObservabilityExceptionFilter', () => {
  it('rethrows the original error', () => {
    const filter = new ObservabilityExceptionFilter();
    const err = new Error('kaboom');
    expect(() => filter.catch(err, host() as never)).toThrowError('kaboom');
  });

  it('rethrows non-Error throws as-is', () => {
    const filter = new ObservabilityExceptionFilter();
    expect(() => filter.catch('string-throw', host() as never)).toThrow();
  });
});
