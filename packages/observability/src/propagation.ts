// SPDX-License-Identifier: BUSL-1.1
/**
 * W3C trace-context propagation helpers.
 *
 * WHY a hand-rolled extractor: the Node SDK's HTTP autoinstrumentation sets parent context for
 * inbound requests, but our Fastify request/response surface needs to:
 *   1. read a `traceparent` even when the SDK is disabled (e.g. in tests, e2e),
 *   2. emit `server-timing` so the web tier can stitch the trace without OTel-JS RUM,
 *   3. parse traceparent on the web side to keep XHR fetches in the same trace family.
 */

const TRACEPARENT_RE =
  /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

export interface TraceParent {
  readonly version: string;
  readonly traceId: string;
  readonly spanId: string;
  readonly flags: string;
}

export function parseTraceParent(header: string | undefined | null): TraceParent | null {
  if (header === undefined || header === null) return null;
  const trimmed = header.trim();
  const match = TRACEPARENT_RE.exec(trimmed);
  if (match === null) return null;
  if (match[2] === '00000000000000000000000000000000') return null;
  if (match[3] === '0000000000000000') return null;
  return {
    version: match[1] as string,
    traceId: match[2] as string,
    spanId: match[3] as string,
    flags: match[4] as string,
  };
}

export function formatTraceParent(tp: TraceParent): string {
  return `${tp.version}-${tp.traceId}-${tp.spanId}-${tp.flags}`;
}

export interface ServerTimingEntry {
  readonly name: string;
  readonly durMs?: number;
  readonly desc?: string;
}

export function formatServerTiming(entries: ReadonlyArray<ServerTimingEntry>): string {
  return entries
    .map((e) => {
      const parts = [e.name];
      if (e.durMs !== undefined) parts.push(`dur=${e.durMs.toFixed(2)}`);
      if (e.desc !== undefined) parts.push(`desc="${escapeServerTimingDesc(e.desc)}"`);
      return parts.join(';');
    })
    .join(', ');
}

function escapeServerTimingDesc(s: string): string {
  return s.replace(/[",;\\]/g, '_');
}

export function buildTraceContextHeaders(
  traceId: string | undefined,
  spanId: string | undefined,
): Record<string, string> {
  if (traceId === undefined || spanId === undefined) return {};
  if (traceId.length !== 32 || spanId.length !== 16) return {};
  return {
    traceparent: `00-${traceId}-${spanId}-01`,
  };
}
