// SPDX-License-Identifier: BUSL-1.1
/**
 * Browser error reporter. Hooks `window.onerror` + `unhandledrejection`, redacts well-known PII
 * patterns from the message + stack before posting to the API.
 *
 * WHY redact-on-client: we cannot trust developers to never log a customer email in a thrown
 * Error; cheaper to defensively scrub on the way out than to remediate after a leak hits Loki.
 */
import {
  observabilityErrorSchema,
  type ObservabilityErrorReport,
  type ObservabilityErrorsBatch,
} from './types.js';
import { redactString } from './redact.js';

export interface ErrorReporterOptions {
  readonly endpoint?: string;
  readonly maxBatch?: number;
  readonly flushIntervalMs?: number;
  readonly sessionId?: string;
  readonly traceIdProvider?: () => string | undefined;
  readonly captureUnhandledRejection?: boolean;
  readonly captureWindowOnError?: boolean;
}

const DEFAULT: Required<Omit<ErrorReporterOptions, 'sessionId' | 'traceIdProvider'>> = {
  endpoint: '/v1/observability/errors',
  maxBatch: 8,
  flushIntervalMs: 5000,
  captureUnhandledRejection: true,
  captureWindowOnError: true,
};

interface ErrorReporterHandle {
  capture: (err: unknown, severity?: ObservabilityErrorReport['severity']) => void;
  flush: () => Promise<void>;
  stop: () => void;
}

export function startErrorReporter(opts: ErrorReporterOptions = {}): ErrorReporterHandle {
  const cfg = {
    ...DEFAULT,
    ...(opts.endpoint !== undefined ? { endpoint: opts.endpoint } : {}),
    ...(opts.maxBatch !== undefined ? { maxBatch: opts.maxBatch } : {}),
    ...(opts.flushIntervalMs !== undefined ? { flushIntervalMs: opts.flushIntervalMs } : {}),
    ...(opts.captureUnhandledRejection !== undefined
      ? { captureUnhandledRejection: opts.captureUnhandledRejection }
      : {}),
    ...(opts.captureWindowOnError !== undefined ? { captureWindowOnError: opts.captureWindowOnError } : {}),
  };
  const buffer: ObservabilityErrorReport[] = [];
  let timer: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  const capture = (err: unknown, severity: ObservabilityErrorReport['severity'] = 'error'): void => {
    if (stopped) return;
    const message =
      err instanceof Error
        ? redactString(err.message)
        : redactString(String(err ?? '<unknown error>'));
    const report: ObservabilityErrorReport = {
      message: message.slice(0, 2048),
      pageUrl: typeof window !== 'undefined' ? window.location.href : '',
      pagePath: typeof window !== 'undefined' ? window.location.pathname : '/',
      occurredAt: new Date().toISOString(),
      severity,
      ...(err instanceof Error && err.name ? { name: err.name } : {}),
      ...(err instanceof Error && err.stack
        ? { stack: redactString(err.stack).slice(0, 8192) }
        : {}),
      ...(opts.sessionId !== undefined ? { sessionId: opts.sessionId } : {}),
      ...(opts.traceIdProvider !== undefined && opts.traceIdProvider() !== undefined
        ? { traceId: opts.traceIdProvider()! }
        : {}),
      ...(typeof navigator !== 'undefined'
        ? { userAgent: navigator.userAgent.slice(0, 512) }
        : {}),
    };
    const validated = observabilityErrorSchema.safeParse(report);
    if (!validated.success) return;
    buffer.push(validated.data);
    if (buffer.length >= cfg.maxBatch) void flush();
  };

  const flush = async (): Promise<void> => {
    if (buffer.length === 0) return;
    const batch: ObservabilityErrorsBatch = { errors: buffer.splice(0, buffer.length) };
    const body = JSON.stringify(batch);
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([body], { type: 'application/json' });
        if (navigator.sendBeacon(cfg.endpoint, blob)) return;
      }
      await fetch(cfg.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        keepalive: true,
        credentials: 'same-origin',
      });
    } catch {
      // Drop on network failure — error reports are best-effort by design.
    }
  };

  if (typeof window !== 'undefined') {
    if (cfg.captureWindowOnError) {
      window.addEventListener('error', (event) => {
        capture(event.error ?? event.message ?? 'window.onerror', 'error');
      });
    }
    if (cfg.captureUnhandledRejection) {
      window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
        capture(event.reason ?? 'unhandledrejection', 'error');
      });
    }
    timer = setInterval(() => {
      void flush();
    }, cfg.flushIntervalMs);
    window.addEventListener('pagehide', () => {
      void flush();
    });
  }

  return {
    capture,
    flush,
    stop: () => {
      stopped = true;
      if (timer !== null) clearInterval(timer);
    },
  };
}
