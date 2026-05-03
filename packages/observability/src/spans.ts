// SPDX-License-Identifier: Apache-2.0
/**
 * Span helpers used at the four SLO-critical call sites:
 *   1. audit-ledger emit (`packages/audit-engine`)
 *   2. RLS context set (`apps/api/src/common/rls.middleware`)
 *   3. probe execution (`packages/probe-engine`, `apps/worker`)
 *   4. LLM call (`packages/llm-provider`)
 *
 * Both helpers are thin wrappers around `tracer.startActiveSpan` that:
 *   - apply a canonical attribute set up-front,
 *   - record exceptions on the span before re-throwing,
 *   - close the span exactly once on either path,
 *   - and (in the `withCriticalSpan` variant) flag the span as `ERROR` even when the underlying
 *     thrown value is not an `Error` instance (defensive for native rejections).
 */
import {
  SpanKind,
  SpanStatusCode,
  trace,
  type Attributes,
  type Span,
  type Tracer,
} from '@opentelemetry/api';

export interface WithSpanOptions {
  /** Tracer scope name. Defaults to `auditforge`. */
  readonly tracerName?: string;
  /** SpanKind. Defaults to INTERNAL. */
  readonly kind?: SpanKind;
  /** Attributes set on the span before `fn` runs. */
  readonly attributes?: Attributes;
}

/**
 * Run `fn` inside an active OTel span. The span is closed automatically. Re-throws errors after
 * recording them on the span so callers see the original failure semantics.
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  opts: WithSpanOptions = {},
): Promise<T> {
  const tracer: Tracer = trace.getTracer(opts.tracerName ?? 'auditforge');
  return tracer.startActiveSpan(
    name,
    {
      kind: opts.kind ?? SpanKind.INTERNAL,
      ...(opts.attributes !== undefined ? { attributes: opts.attributes } : {}),
    },
    async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (err) {
        recordException(span, err);
        throw err;
      } finally {
        span.end();
      }
    },
  );
}

/**
 * Same as {@link withSpan} but tags the span with `auditforge.critical=true`. Used at the four
 * SLO-critical call sites so that downstream sampling decisions / dashboards can preserve them
 * even under aggressive head sampling. Tail-sampling in the OTel collector is configured to
 * keep 100% of spans where this attribute is true.
 */
export async function withCriticalSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  opts: WithSpanOptions = {},
): Promise<T> {
  const merged: Attributes = {
    ...(opts.attributes ?? {}),
    'auditforge.critical': true,
  };
  return withSpan(name, fn, { ...opts, attributes: merged });
}

function recordException(span: Span, err: unknown): void {
  if (err instanceof Error) {
    span.recordException(err);
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    return;
  }
  // Defensive — non-Error throws (string, number, undefined) still need to be visible.
  const message = typeof err === 'string' ? err : safeStringify(err);
  span.recordException({ name: 'NonErrorThrow', message });
  span.setStatus({ code: SpanStatusCode.ERROR, message });
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

/** Convenience: span name conventions used across the codebase. */
export const SpanNames = {
  ledgerEmit: 'auditforge.ledger.emit',
  ledgerVerifyChain: 'auditforge.ledger.verify_chain',
  rlsSetTenant: 'auditforge.rls.set_tenant',
  probeExecute: 'auditforge.probe.execute',
  llmCall: 'auditforge.llm.call',
} as const;
