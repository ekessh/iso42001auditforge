// SPDX-License-Identifier: BUSL-1.1
/**
 * Browser-side W3C trace-context propagation helpers and a fetch wrapper that:
 *   1. issues a randomized trace + span id when none exists yet,
 *   2. attaches `traceparent` to outgoing requests,
 *   3. reads `x-trace-id` and `server-timing` from the response so the SPA can stitch a span tree.
 */

const TRACEPARENT_RE =
  /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

export interface TraceParent {
  readonly version: string;
  readonly traceId: string;
  readonly spanId: string;
  readonly flags: string;
}

export function parseTraceParent(header: string | null | undefined): TraceParent | null {
  if (header === null || header === undefined) return null;
  const m = TRACEPARENT_RE.exec(header.trim());
  if (m === null) return null;
  if (m[2] === '00000000000000000000000000000000') return null;
  if (m[3] === '0000000000000000') return null;
  return {
    version: m[1] as string,
    traceId: m[2] as string,
    spanId: m[3] as string,
    flags: m[4] as string,
  };
}

export function formatTraceParent(tp: TraceParent): string {
  return `${tp.version}-${tp.traceId}-${tp.spanId}-${tp.flags}`;
}

export function newTraceId(): string {
  return randomHex(32);
}

export function newSpanId(): string {
  return randomHex(16);
}

function randomHex(len: number): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(len / 2);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  let out = '';
  for (let i = 0; i < len; i += 1) out += Math.floor(Math.random() * 16).toString(16);
  return out;
}

export interface TraceAwareFetchOptions {
  readonly traceIdProvider?: () => string;
  readonly spanIdProvider?: () => string;
  readonly onResponseTraceId?: (traceId: string) => void;
}

export function instrumentFetch(opts: TraceAwareFetchOptions = {}): typeof fetch {
  const traceId = opts.traceIdProvider ?? newTraceId;
  const spanId = opts.spanIdProvider ?? newSpanId;
  return async (input, init) => {
    const merged: RequestInit = init !== undefined ? { ...init } : {};
    const headers = new Headers(merged.headers ?? {});
    if (!headers.has('traceparent')) {
      headers.set('traceparent', `00-${traceId()}-${spanId()}-01`);
    }
    merged.headers = headers;
    const res = await fetch(input, merged);
    if (opts.onResponseTraceId !== undefined) {
      const id = res.headers.get('x-trace-id');
      if (id !== null) opts.onResponseTraceId(id);
    }
    return res;
  };
}
