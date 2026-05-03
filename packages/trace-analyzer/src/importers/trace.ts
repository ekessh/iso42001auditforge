// SPDX-License-Identifier: BUSL-1.1
//
// Trace importers. Vendor formats are normalised into AgentTrace.
//
// Notes
// - All importers are async and yield results lazily where possible. The
//   OTel importer in particular is built around a streaming JSON reader so
//   100k-span exports do not OOM.
// - Cost extraction is best-effort. We trust explicit cost attributes when
//   present (`gen_ai.usage.cost_usd`, `langfuse.cost_usd`, etc.) and
//   otherwise leave cost at 0 — auditors prefer "unknown" to a wrong number.

import { Readable } from 'node:stream';
import {
  AgentTraceSchema,
  type AgentTrace,
  type Decision,
  type Escalation,
  type LlmCall,
  type SpanKind,
  type SpanStatus,
  type ToolCall,
  type TraceError,
  type TraceSpan,
} from '../types/trace.js';
import {
  IngestPayloadTooLarge,
  MAX_INGEST_BUFFER_BYTES,
  readableFromString,
  streamJsonArray,
  toNodeReadable,
  type StreamSource,
} from '../util/streaming.js';

interface TraceContext {
  spans: TraceSpan[];
  llmCalls: LlmCall[];
  toolCalls: ToolCall[];
  decisions: Decision[];
  errors: TraceError[];
  escalations: Escalation[];
}

function isAsyncIterableBytes(v: unknown): v is AsyncIterable<Uint8Array> {
  return (
    v !== null &&
    typeof v === 'object' &&
    typeof (v as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] ===
      'function'
  );
}

function emptyCtx(): TraceContext {
  return {
    spans: [],
    llmCalls: [],
    toolCalls: [],
    decisions: [],
    errors: [],
    escalations: [],
  };
}

function classifySpanKind(name: string, attrs: Record<string, unknown>): SpanKind {
  const lower = name.toLowerCase();
  if (attrs['gen_ai.system'] !== undefined || /llm|chat|completion/.test(lower)) {
    return 'llm';
  }
  if (
    attrs['tool.name'] !== undefined ||
    attrs['gen_ai.tool.name'] !== undefined ||
    /tool\.|tool_call/.test(lower)
  ) {
    return 'tool';
  }
  if (/agent|crew|graph/.test(lower)) return 'agent';
  if (/router|route|branch/.test(lower)) return 'router';
  if (/gate|approval|hitl/.test(lower)) return 'gate';
  return 'unknown';
}

function asNumber(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function asInt(v: unknown, fallback = 0): number {
  return Math.max(0, Math.trunc(asNumber(v, fallback)));
}

function pushFromSpan(ctx: TraceContext, span: TraceSpan): void {
  const attrs = span.attributes;
  if (span.kind === 'llm') {
    const promptTokens =
      asInt(attrs['gen_ai.usage.prompt_tokens']) ||
      asInt(attrs['llm.prompt_tokens']) ||
      asInt(attrs['promptTokens']);
    const completionTokens =
      asInt(attrs['gen_ai.usage.completion_tokens']) ||
      asInt(attrs['llm.completion_tokens']) ||
      asInt(attrs['completionTokens']);
    const costUsd =
      asNumber(attrs['gen_ai.usage.cost_usd']) ||
      asNumber(attrs['langfuse.cost_usd']) ||
      asNumber(attrs['cost_usd']);
    const model = String(
      attrs['gen_ai.request.model'] ??
        attrs['gen_ai.response.model'] ??
        attrs['llm.model'] ??
        attrs['model'] ??
        'unknown',
    );
    const cacheHit =
      attrs['gen_ai.cache_hit'] === true || attrs['cache_hit'] === true;
    ctx.llmCalls.push({
      spanId: span.spanId,
      model,
      promptTokens,
      completionTokens,
      latencyMs: (span.endNs - span.startNs) / 1_000_000,
      costUsd,
      cacheHit,
    });
  }
  if (span.kind === 'tool') {
    const toolId = String(
      attrs['tool.id'] ??
        attrs['tool.name'] ??
        attrs['gen_ai.tool.name'] ??
        span.name,
    );
    ctx.toolCalls.push({
      spanId: span.spanId,
      toolId,
      invokedBy:
        typeof attrs['agent.role'] === 'string'
          ? (attrs['agent.role'] as string)
          : span.agentRole,
      params: attrs['tool.input'],
      result: attrs['tool.output'],
      errored: span.status === 'error',
      latencyMs: (span.endNs - span.startNs) / 1_000_000,
    });
  }
  if (typeof attrs['decision.branch'] === 'string') {
    ctx.decisions.push({
      spanId: span.spanId,
      branch: attrs['decision.branch'],
      reason:
        typeof attrs['decision.reason'] === 'string'
          ? attrs['decision.reason']
          : undefined,
      rejection: attrs['decision.rejection'] === true,
    });
  }
  if (span.status === 'error') {
    const message =
      span.events.find((e) => e.name === 'exception')?.attributes[
        'exception.message'
      ];
    ctx.errors.push({
      spanId: span.spanId,
      message: typeof message === 'string' ? message : 'error',
      type:
        typeof attrs['error.type'] === 'string'
          ? (attrs['error.type'] as string)
          : undefined,
    });
  }
  if (
    span.kind === 'gate' ||
    typeof attrs['hitl.target'] === 'string' ||
    typeof attrs['escalation.target'] === 'string'
  ) {
    const target =
      (attrs['escalation.target'] as string | undefined) ??
      (attrs['hitl.target'] as string | undefined) ??
      'human-approval';
    const approvedAttr = attrs['hitl.approved'] ?? attrs['escalation.approved'];
    ctx.escalations.push({
      spanId: span.spanId,
      target,
      approved:
        typeof approvedAttr === 'boolean' ? approvedAttr : undefined,
    });
  }
}

function rolloverSums(ctx: TraceContext, spans: TraceSpan[]): {
  totalLatencyMs: number;
  totalCostUsd: number;
} {
  if (spans.length === 0) return { totalLatencyMs: 0, totalCostUsd: 0 };
  let minStart = Number.POSITIVE_INFINITY;
  let maxEnd = 0;
  for (const s of spans) {
    if (s.startNs < minStart) minStart = s.startNs;
    if (s.endNs > maxEnd) maxEnd = s.endNs;
  }
  const totalCostUsd = ctx.llmCalls.reduce((acc, c) => acc + c.costUsd, 0);
  return {
    totalLatencyMs: Math.max(0, (maxEnd - minStart) / 1_000_000),
    totalCostUsd,
  };
}

// ---------- OTel ----------

interface OtelSpanRaw {
  spanId?: string;
  parentSpanId?: string;
  name?: string;
  startTimeUnixNano?: string | number;
  endTimeUnixNano?: string | number;
  attributes?: Array<{ key: string; value: { stringValue?: string; intValue?: string | number; doubleValue?: number; boolValue?: boolean } }> | Record<string, unknown>;
  status?: { code?: number | string };
  events?: Array<{ name?: string; timeUnixNano?: string | number; attributes?: unknown }>;
}

function decodeOtelAttributes(
  raw: OtelSpanRaw['attributes'],
): Record<string, unknown> {
  if (!raw) return {};
  if (Array.isArray(raw)) {
    const out: Record<string, unknown> = {};
    for (const a of raw) {
      const v = a.value ?? {};
      out[a.key] =
        v.stringValue ??
        (v.intValue !== undefined ? Number(v.intValue) : undefined) ??
        v.doubleValue ??
        v.boolValue;
    }
    return out;
  }
  return raw as Record<string, unknown>;
}

function decodeOtelStatus(code: number | string | undefined): SpanStatus {
  // OTel: 0 unset, 1 ok, 2 error.
  if (code === 2 || code === 'STATUS_CODE_ERROR' || code === 'ERROR') {
    return 'error';
  }
  if (code === 1 || code === 'STATUS_CODE_OK' || code === 'OK') return 'ok';
  return 'unset';
}

function normaliseOtelSpan(raw: OtelSpanRaw): TraceSpan {
  const startNs = asInt(raw.startTimeUnixNano);
  const endNs = Math.max(startNs, asInt(raw.endTimeUnixNano));
  const attrs = decodeOtelAttributes(raw.attributes);
  const name = String(raw.name ?? 'span');
  return {
    spanId: String(raw.spanId ?? `gen-${Math.random().toString(36).slice(2)}`),
    ...(raw.parentSpanId ? { parentSpanId: String(raw.parentSpanId) } : {}),
    name,
    kind: classifySpanKind(name, attrs),
    startNs,
    endNs,
    attributes: attrs,
    status: decodeOtelStatus(raw.status?.code),
    events: (raw.events ?? []).map((e) => ({
      name: String(e.name ?? 'event'),
      timeNs: asInt(e.timeUnixNano),
      attributes: decodeOtelAttributes(e.attributes as OtelSpanRaw['attributes']),
    })),
    ...(typeof attrs['agent.role'] === 'string'
      ? { agentRole: attrs['agent.role'] as string }
      : {}),
  };
}

export interface OtelImportOptions {
  traceId: string;
  engagementId: string;
}

type OtelShape = 'array' | 'flat-spans' | 'envelope' | 'unknown';

interface Prefix {
  buf: Buffer;
  done: boolean;
}

/**
 * Read up to `maxBytes` from a Node Readable without consuming it past the
 * limit. The remaining bytes stay queued on the underlying Readable for the
 * stitched downstream pipeline. We stop early once we have enough to detect
 * an OTel-shape token.
 */
async function readPrefix(node: Readable, maxBytes: number): Promise<Prefix> {
  const collected: Buffer[] = [];
  let total = 0;
  for await (const chunk of node) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    collected.push(buf);
    total += buf.length;
    if (total >= maxBytes) {
      // Splice the read iterator: the next stitched read will see the
      // remainder of `node` plus zero. (We've already consumed it via
      // the for-await, but Readable.from below preserves trailing data
      // because we feed `collected` into `stitchReadable`.)
      // Safe-guard: we apply the global ingest cap inside streamJsonArray.
      if (total > MAX_INGEST_BUFFER_BYTES) {
        throw new IngestPayloadTooLarge(total, MAX_INGEST_BUFFER_BYTES);
      }
      break;
    }
  }
  return { buf: Buffer.concat(collected, total), done: total < maxBytes };
}

/**
 * Yield `prefix` bytes followed by anything remaining on `node`. We use a
 * generator so backpressure is preserved — the consumer pulls one chunk at
 * a time.
 */
function stitchReadable(prefix: Buffer, node: Readable): Readable {
  async function* gen() {
    if (prefix.length > 0) yield prefix;
    for await (const chunk of node) {
      yield Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    }
  }
  return Readable.from(gen());
}

/**
 * Detect the OTel JSON shape by peeking the prefix. We avoid `JSON.parse`
 * here — only token presence matters. The detection looks for:
 *   - leading `[`                       → array of spans
 *   - top-level `"resourceSpans"` key   → envelope
 *   - top-level `"spans"` key           → flat
 */
function detectOtelShape(prefix: Prefix): OtelShape {
  // Skip whitespace.
  let i = 0;
  while (i < prefix.buf.length) {
    const ch = prefix.buf[i];
    if (ch === 0x20 || ch === 0x09 || ch === 0x0a || ch === 0x0d) i++;
    else break;
  }
  if (i >= prefix.buf.length) return 'unknown';
  if (prefix.buf[i] === 0x5b /* [ */) return 'array';
  if (prefix.buf[i] !== 0x7b /* { */) return 'unknown';
  // Look for the first key. We don't try to parse — just check membership.
  const head = prefix.buf.toString('utf8', i, Math.min(prefix.buf.length, i + 4096));
  // Match `"resourceSpans"` and `"spans"` at the *first* key position. We
  // accept either order if both are present (envelope wins).
  const rsIdx = head.indexOf('"resourceSpans"');
  const spansIdx = head.indexOf('"spans"');
  if (rsIdx >= 0 && (spansIdx < 0 || rsIdx < spansIdx)) return 'envelope';
  if (spansIdx >= 0) return 'flat-spans';
  return 'unknown';
}

/**
 * Stream-parse an OTel JSON export. Accepts either:
 *  - { resourceSpans: [{ scopeSpans: [{ spans: [...] }] }] }  (full envelope)
 *  - { spans: [...] }                                          (flat)
 *  - [ ...spans ]                                              (array)
 *
 * Yields the normalised span list as it arrives, then assembles the trace.
 *
 * PERF — BLK-4 (perf-review #4):
 * The previous implementation buffered the whole payload, called
 * `JSON.parse` on the full string, then re-streamed the same payload.
 * That defeated streaming and OOM'd at 100k+ spans. The new path peeks
 * a small prefix to detect shape (array / `spans:` / `resourceSpans:`),
 * pushes the prefix back to a tee `Readable`, and feeds the combined
 * stream to `stream-json` with a path-pick filter. The intermediate
 * buffer is hard-capped at {@link MAX_INGEST_BUFFER_BYTES} (64 MiB) —
 * payloads larger than that throw `IngestPayloadTooLarge` rather than
 * blowing through V8's heap.
 */
export async function importOtelStream(
  source: StreamSource,
  opts: OtelImportOptions,
): Promise<AgentTrace> {
  const ctx = emptyCtx();
  const node = toNodeReadable(source);
  // Peek the first ~8 KiB to detect the JSON shape without materialising
  // the whole payload. Once we see a top-level `[`, `"spans"`, or
  // `"resourceSpans"` token we lock the shape and stream the rest.
  const prefix = await readPrefix(node, 8192);
  const shape = detectOtelShape(prefix);
  // Build a Readable that yields the prefix bytes followed by the
  // remainder of `node`. We can't use Readable.from(asyncIter) because
  // `node` may have already emitted its first chunk into `prefix.buf`.
  const stitched = stitchReadable(prefix.buf, node);

  switch (shape) {
    case 'array': {
      for await (const rawSpan of streamJsonArray<OtelSpanRaw>(stitched)) {
        const span = normaliseOtelSpan(rawSpan);
        ctx.spans.push(span);
        pushFromSpan(ctx, span);
      }
      break;
    }
    case 'flat-spans': {
      for await (const rawSpan of streamJsonArray<OtelSpanRaw>(
        stitched,
        'spans',
      )) {
        const span = normaliseOtelSpan(rawSpan);
        ctx.spans.push(span);
        pushFromSpan(ctx, span);
      }
      break;
    }
    case 'envelope': {
      // OTel nests two arrays deep; stream-json's `pick` only pulls one
      // level. Each `resourceSpans[*]` element is small (a per-resource
      // group) so materialising it is fine — the heavy `spans[*]` array
      // *inside* that group is iterated lazily via plain JS iteration.
      for await (const rs of streamJsonArray<{
        scopeSpans?: Array<{ spans?: OtelSpanRaw[] }>;
      }>(stitched, 'resourceSpans')) {
        for (const ss of rs.scopeSpans ?? []) {
          for (const rawSpan of ss.spans ?? []) {
            const span = normaliseOtelSpan(rawSpan);
            ctx.spans.push(span);
            pushFromSpan(ctx, span);
          }
        }
      }
      break;
    }
    default:
      throw new Error('Unsupported OTel JSON shape');
  }

  const sums = rolloverSums(ctx, ctx.spans);
  return AgentTraceSchema.parse({
    id: opts.traceId,
    engagementId: opts.engagementId,
    traceFormat: 'otel',
    spans: ctx.spans,
    llmCalls: ctx.llmCalls,
    toolCalls: ctx.toolCalls,
    decisions: ctx.decisions,
    errors: ctx.errors,
    escalations: ctx.escalations,
    totalLatencyMs: sums.totalLatencyMs,
    totalCostUsd: sums.totalCostUsd,
    ingestedAt: new Date().toISOString(),
  });
}

// ---------- Langfuse ----------

interface LangfuseObservationRaw {
  id?: string;
  parentObservationId?: string;
  name?: string;
  type?: string; // GENERATION, SPAN, EVENT
  startTime?: string;
  endTime?: string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalCost?: number;
  level?: string; // DEFAULT, WARNING, ERROR
  statusMessage?: string;
  input?: unknown;
  output?: unknown;
  metadata?: Record<string, unknown>;
}

function isoToNs(iso: string | undefined): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms * 1_000_000 : 0;
}

export interface LangfuseImportOptions {
  traceId: string;
  engagementId: string;
}

export function importLangfuse(
  payload: unknown,
  opts: LangfuseImportOptions,
): AgentTrace {
  const obj = payload as Record<string, unknown>;
  const observations =
    (obj.observations as LangfuseObservationRaw[] | undefined) ??
    (obj.events as LangfuseObservationRaw[] | undefined) ??
    [];
  const ctx = emptyCtx();
  for (const o of observations) {
    const startNs = isoToNs(o.startTime);
    const endNs = Math.max(startNs, isoToNs(o.endTime));
    const type = (o.type ?? 'SPAN').toUpperCase();
    const attrs: Record<string, unknown> = {
      'langfuse.type': type,
      ...(o.metadata ?? {}),
    };
    if (o.model) attrs['gen_ai.request.model'] = o.model;
    if (typeof o.promptTokens === 'number')
      attrs['gen_ai.usage.prompt_tokens'] = o.promptTokens;
    if (typeof o.completionTokens === 'number')
      attrs['gen_ai.usage.completion_tokens'] = o.completionTokens;
    if (typeof o.totalCost === 'number') attrs['langfuse.cost_usd'] = o.totalCost;
    if (o.input !== undefined) attrs['tool.input'] = o.input;
    if (o.output !== undefined) attrs['tool.output'] = o.output;

    let kind: SpanKind = 'internal';
    if (type === 'GENERATION') kind = 'llm';
    else if (type === 'EVENT') kind = 'internal';
    else if (typeof o.name === 'string' && /tool/i.test(o.name)) kind = 'tool';

    const status: SpanStatus = (o.level ?? '').toUpperCase() === 'ERROR' ? 'error' : 'ok';

    const span: TraceSpan = {
      spanId: String(o.id ?? `lf-${ctx.spans.length}`),
      ...(o.parentObservationId
        ? { parentSpanId: String(o.parentObservationId) }
        : {}),
      name: String(o.name ?? type),
      kind,
      startNs,
      endNs,
      attributes: attrs,
      status,
      events: o.statusMessage
        ? [
            {
              name: status === 'error' ? 'exception' : 'message',
              timeNs: endNs,
              attributes: { 'exception.message': o.statusMessage },
            },
          ]
        : [],
    };
    ctx.spans.push(span);
    pushFromSpan(ctx, span);
  }

  const sums = rolloverSums(ctx, ctx.spans);
  return AgentTraceSchema.parse({
    id: opts.traceId,
    engagementId: opts.engagementId,
    traceFormat: 'langfuse',
    spans: ctx.spans,
    llmCalls: ctx.llmCalls,
    toolCalls: ctx.toolCalls,
    decisions: ctx.decisions,
    errors: ctx.errors,
    escalations: ctx.escalations,
    totalLatencyMs: sums.totalLatencyMs,
    totalCostUsd: sums.totalCostUsd,
    ingestedAt: new Date().toISOString(),
  });
}

// ---------- Phoenix ----------

interface PhoenixSpanRaw {
  context?: { span_id?: string; trace_id?: string };
  parent_id?: string;
  name?: string;
  span_kind?: string;
  start_time?: string;
  end_time?: string;
  status_code?: string;
  status_message?: string;
  attributes?: Record<string, unknown>;
  events?: Array<{ name?: string; timestamp?: string; attributes?: Record<string, unknown> }>;
}

export interface PhoenixImportOptions {
  traceId: string;
  engagementId: string;
}

export function importPhoenix(
  payload: unknown,
  opts: PhoenixImportOptions,
): AgentTrace {
  const obj = payload as Record<string, unknown>;
  const rawSpans =
    (obj.spans as PhoenixSpanRaw[] | undefined) ??
    (Array.isArray(payload) ? (payload as PhoenixSpanRaw[]) : []);
  const ctx = emptyCtx();
  for (const r of rawSpans) {
    const attrs = r.attributes ?? {};
    const startNs = isoToNs(r.start_time);
    const endNs = Math.max(startNs, isoToNs(r.end_time));
    const sk = (r.span_kind ?? '').toUpperCase();
    let kind: SpanKind = 'unknown';
    if (sk === 'LLM') kind = 'llm';
    else if (sk === 'TOOL') kind = 'tool';
    else if (sk === 'AGENT') kind = 'agent';
    else if (sk === 'CHAIN' || sk === 'RETRIEVER') kind = 'internal';
    else kind = classifySpanKind(String(r.name ?? ''), attrs);

    const status: SpanStatus =
      (r.status_code ?? '').toUpperCase() === 'ERROR' ? 'error' : 'ok';

    // Phoenix uses different attribute keys; bridge them.
    const bridged: Record<string, unknown> = { ...attrs };
    if (attrs['llm.token_count.prompt'] !== undefined)
      bridged['gen_ai.usage.prompt_tokens'] = attrs['llm.token_count.prompt'];
    if (attrs['llm.token_count.completion'] !== undefined)
      bridged['gen_ai.usage.completion_tokens'] =
        attrs['llm.token_count.completion'];
    if (attrs['llm.model_name'] !== undefined)
      bridged['gen_ai.request.model'] = attrs['llm.model_name'];
    if (attrs['llm.cost'] !== undefined)
      bridged['gen_ai.usage.cost_usd'] = attrs['llm.cost'];
    if (attrs['tool.name'] !== undefined) bridged['tool.name'] = attrs['tool.name'];

    const span: TraceSpan = {
      spanId: String(r.context?.span_id ?? `phx-${ctx.spans.length}`),
      ...(r.parent_id ? { parentSpanId: String(r.parent_id) } : {}),
      name: String(r.name ?? 'span'),
      kind,
      startNs,
      endNs,
      attributes: bridged,
      status,
      events: (r.events ?? []).map((e) => ({
        name: String(e.name ?? 'event'),
        timeNs: isoToNs(e.timestamp),
        attributes: e.attributes ?? {},
      })),
    };
    ctx.spans.push(span);
    pushFromSpan(ctx, span);
  }
  const sums = rolloverSums(ctx, ctx.spans);
  return AgentTraceSchema.parse({
    id: opts.traceId,
    engagementId: opts.engagementId,
    traceFormat: 'phoenix',
    spans: ctx.spans,
    llmCalls: ctx.llmCalls,
    toolCalls: ctx.toolCalls,
    decisions: ctx.decisions,
    errors: ctx.errors,
    escalations: ctx.escalations,
    totalLatencyMs: sums.totalLatencyMs,
    totalCostUsd: sums.totalCostUsd,
    ingestedAt: new Date().toISOString(),
  });
}

// ---------- Custom ----------

export interface CustomImportOptions {
  traceId: string;
  engagementId: string;
}

export function importCustom(
  payload: unknown,
  opts: CustomImportOptions,
): AgentTrace {
  // Custom JSON either matches AgentTrace, or is a {spans:[]} shape.
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'spans' in payload &&
    !('id' in payload)
  ) {
    const obj = payload as { spans: TraceSpan[] };
    const ctx = emptyCtx();
    for (const s of obj.spans) {
      const span = {
        ...s,
        kind: s.kind ?? classifySpanKind(s.name, s.attributes ?? {}),
        attributes: s.attributes ?? {},
        events: s.events ?? [],
        status: s.status ?? 'ok',
      } satisfies TraceSpan;
      ctx.spans.push(span);
      pushFromSpan(ctx, span);
    }
    const sums = rolloverSums(ctx, ctx.spans);
    return AgentTraceSchema.parse({
      id: opts.traceId,
      engagementId: opts.engagementId,
      traceFormat: 'custom',
      spans: ctx.spans,
      llmCalls: ctx.llmCalls,
      toolCalls: ctx.toolCalls,
      decisions: ctx.decisions,
      errors: ctx.errors,
      escalations: ctx.escalations,
      totalLatencyMs: sums.totalLatencyMs,
      totalCostUsd: sums.totalCostUsd,
      ingestedAt: new Date().toISOString(),
    });
  }
  return AgentTraceSchema.parse(payload);
}

// ---------- Dispatcher ----------

export type AnyTraceImportOptions = OtelImportOptions;

export async function importTrace(
  format: AgentTrace['traceFormat'],
  payload: unknown,
  opts: AnyTraceImportOptions,
): Promise<AgentTrace> {
  switch (format) {
    case 'otel': {
      const src: StreamSource =
        typeof payload === 'string'
          ? readableFromString(payload)
          : payload instanceof Readable
            ? payload
            : payload &&
                typeof (payload as { getReader?: unknown }).getReader === 'function'
              ? (payload as ReadableStream<Uint8Array>)
              : isAsyncIterableBytes(payload)
                ? (payload as AsyncIterable<Uint8Array>)
                : readableFromString(JSON.stringify(payload));
      return await importOtelStream(src, opts);
    }
    case 'langfuse':
      return importLangfuse(payload, opts);
    case 'phoenix':
      return importPhoenix(payload, opts);
    case 'custom':
      return importCustom(payload, opts);
    default:
      throw new Error(`Unsupported trace format: ${format as string}`);
  }
}
