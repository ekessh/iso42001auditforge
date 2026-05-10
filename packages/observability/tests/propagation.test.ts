// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect } from 'vitest';

import {
  parseTraceParent,
  formatTraceParent,
  formatServerTiming,
  buildTraceContextHeaders,
} from '../src/propagation.js';

describe('trace propagation', () => {
  it('parses a valid traceparent', () => {
    const tp = parseTraceParent('00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01');
    expect(tp).not.toBeNull();
    expect(tp?.traceId).toBe('0af7651916cd43dd8448eb211c80319c');
    expect(tp?.spanId).toBe('b7ad6b7169203331');
  });

  it('rejects all-zero trace id', () => {
    const tp = parseTraceParent('00-00000000000000000000000000000000-b7ad6b7169203331-01');
    expect(tp).toBeNull();
  });

  it('rejects all-zero span id', () => {
    const tp = parseTraceParent('00-0af7651916cd43dd8448eb211c80319c-0000000000000000-01');
    expect(tp).toBeNull();
  });

  it('rejects malformed input', () => {
    expect(parseTraceParent(null)).toBeNull();
    expect(parseTraceParent(undefined)).toBeNull();
    expect(parseTraceParent('not-a-traceparent')).toBeNull();
    expect(parseTraceParent('00-short-x-01')).toBeNull();
  });

  it('round-trips parse / format', () => {
    const header = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';
    const parsed = parseTraceParent(header);
    expect(parsed).not.toBeNull();
    expect(formatTraceParent(parsed!)).toBe(header);
  });

  it('formats server-timing header', () => {
    const out = formatServerTiming([
      { name: 'app', durMs: 12.34, desc: 'handler' },
      { name: 'db' },
    ]);
    expect(out).toBe('app;dur=12.34;desc="handler", db');
  });

  it('escapes server-timing description', () => {
    const out = formatServerTiming([{ name: 'app', desc: 'bad"quote;sep' }]);
    expect(out).not.toContain('"quote');
  });

  it('builds traceparent only when both ids are present and well-formed', () => {
    expect(buildTraceContextHeaders(undefined, undefined)).toEqual({});
    expect(buildTraceContextHeaders('short', 'b7ad6b7169203331')).toEqual({});
    const out = buildTraceContextHeaders(
      '0af7651916cd43dd8448eb211c80319c',
      'b7ad6b7169203331',
    );
    expect(out.traceparent).toBe('00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01');
  });
});
