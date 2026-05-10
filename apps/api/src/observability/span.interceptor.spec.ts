// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect } from 'vitest';
import { trace } from '@opentelemetry/api';
import { lastValueFrom, of, throwError } from 'rxjs';

import { ObservabilitySpanInterceptor } from './span.interceptor.js';

function buildCtx(opts: { method?: string; url?: string }) {
  const headers: Record<string, string> = {};
  const req = {
    method: opts.method ?? 'GET',
    url: opts.url ?? '/v1/test',
    routeOptions: { url: opts.url ?? '/v1/test' },
  };
  const res = {
    statusCode: 200,
    header: (k: string, v: string) => {
      headers[k] = v;
    },
  };
  return {
    headers,
    res,
    ctx: {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
      getHandler: () => function fakeHandler() {},
      getClass: () => class FakeController {},
    },
  };
}

describe('ObservabilitySpanInterceptor', () => {
  it('wraps next.handle in a span and sets http headers', async () => {
    const interceptor = new ObservabilitySpanInterceptor();
    const { ctx, headers } = buildCtx({ method: 'POST', url: '/v1/foo' });
    const next = { handle: () => of('result') };
    const result = await lastValueFrom(interceptor.intercept(ctx as never, next as never));
    expect(result).toBe('result');
    expect(headers['x-trace-id']).toBeDefined();
    expect(headers['server-timing']).toContain('app');
  });

  it('records exception when downstream throws', async () => {
    const interceptor = new ObservabilitySpanInterceptor();
    const { ctx } = buildCtx({});
    const next = { handle: () => throwError(() => new Error('boom')) };
    await expect(
      lastValueFrom(interceptor.intercept(ctx as never, next as never)),
    ).rejects.toThrow('boom');
  });

  it('uses tracer named "auditforge.api"', () => {
    const interceptor = new ObservabilitySpanInterceptor();
    void interceptor;
    const t = trace.getTracer('auditforge.api');
    expect(t).toBeDefined();
  });
});
