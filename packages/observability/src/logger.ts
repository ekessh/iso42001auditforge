// SPDX-License-Identifier: BUSL-1.1
/**
 * Pino logger factory pre-wired for AuditForge.
 *
 * Features:
 *   1. `mixin` reads the active OTel span context and attaches `trace_id`, `span_id`, `trace_flags`
 *      to every log record so Loki -> Tempo correlation works.
 *   2. Aggressive `redact` list covers HTTP headers (authorization, cookie, webauthn attestation),
 *      request/response bodies that may include PII, LLM prompts/completions, TSA tokens and
 *      digital signatures, JWTs, idempotency keys, and S3 presigned URLs.
 *   3. Optional `requestContextProvider` callback supplies `request_id`, `firm_id_hashed`, and the
 *      `ledger_event_id` set by {@link correlateLedgerEvent}.
 */
import { trace, type SpanContext } from '@opentelemetry/api';
import pino, { type Logger, type LoggerOptions } from 'pino';

import { takeLedgerEventIdForLog } from './correlate.js';

/**
 * Default redact paths. Anything matching these dot/array paths is replaced with `[REDACTED]`.
 *
 * The list is intentionally over-inclusive: it is cheap and a missed entry cannot be recalled
 * once shipped to a log store.
 */
export const DEFAULT_REDACT_PATHS: readonly string[] = [
  // HTTP headers that carry credentials / attestations.
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  'req.headers["x-webauthn-attestation"]',
  'req.headers["x-api-key"]',
  'req.headers["idempotency-key"]',
  'res.headers["set-cookie"]',
  // Request / response bodies (autoLogging on Fastify will pull these in if enabled).
  'req.body',
  'req.body.*',
  'res.body',
  'res.body.*',
  // LLM telemetry foot-guns.
  'prompt',
  'prompts',
  'prompt.*',
  'prompts.*',
  'completion',
  'completion.*',
  'messages',
  'messages.*',
  'input',
  'output',
  // TSA / signature material.
  'signature',
  'signatures',
  'signature.*',
  'tsa',
  'tsaToken',
  'tsa_token',
  'jwt',
  'jwtToken',
  'bearer',
  // Object-storage presigned URLs (often carry SigV4 signatures inline).
  'presignedUrl',
  'presigned_url',
  'signedUrl',
  // Misc secrets.
  '*.password',
  '*.secret',
  '*.token',
  '*.privateKey',
  '*.private_key',
  '*.apiKey',
];

export interface CreateLoggerOptions {
  /** Pino level: `fatal`|`error`|`warn`|`info`|`debug`|`trace`. Defaults to `info`. */
  readonly level?: LoggerOptions['level'];
  /** Service name; included on every log line as `service`. */
  readonly serviceName: string;
  /** Service version; included as `service_version`. */
  readonly serviceVersion?: string;
  /** Deployment environment label (`production`, etc.). */
  readonly environment?: string;
  /** Extra paths appended to the default redact list. */
  readonly extraRedactPaths?: readonly string[];
  /**
   * Provide per-request context (request_id, firm bucket). Called once per log line.
   * Implementations should be safe-fail: return an empty object on miss, never throw.
   */
  readonly requestContextProvider?: () => Record<string, unknown>;
  /** When true, suppresses the trace-id mixin (used in tests). */
  readonly disableTraceMixin?: boolean;
  /** Override pino destination (test helper). */
  readonly destination?: pino.DestinationStream;
}

/** Returns a new pino logger with the AuditForge default redact + trace mixin behaviour. */
export function createLogger(opts: CreateLoggerOptions): Logger {
  const baseRedact = DEFAULT_REDACT_PATHS.slice();
  if (opts.extraRedactPaths !== undefined) {
    for (const p of opts.extraRedactPaths) baseRedact.push(p);
  }

  const base: Record<string, unknown> = {
    service: opts.serviceName,
  };
  if (opts.serviceVersion !== undefined) base['service_version'] = opts.serviceVersion;
  if (opts.environment !== undefined) base['environment'] = opts.environment;

  const mixin: LoggerOptions['mixin'] = (): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    if (opts.disableTraceMixin !== true) {
      const ctx = readActiveSpanContext();
      if (ctx !== null) {
        out['trace_id'] = ctx.traceId;
        out['span_id'] = ctx.spanId;
        out['trace_flags'] = ctx.traceFlags;
      }
    }
    if (opts.requestContextProvider !== undefined) {
      try {
        Object.assign(out, opts.requestContextProvider());
      } catch {
        // Never let the logger throw because of a context-provider bug.
      }
    }
    const ledgerEventId = takeLedgerEventIdForLog();
    if (ledgerEventId !== undefined) {
      out['ledger_event_id'] = ledgerEventId;
    }
    return out;
  };

  const options: LoggerOptions = {
    level: opts.level ?? 'info',
    base,
    mixin,
    redact: {
      paths: baseRedact,
      censor: '[REDACTED]',
      remove: false,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label): { level: string } => ({ level: label }),
    },
  };

  return opts.destination !== undefined ? pino(options, opts.destination) : pino(options);
}

function readActiveSpanContext(): SpanContext | null {
  const span = trace.getActiveSpan();
  if (span === undefined) return null;
  const ctx = span.spanContext();
  if (ctx.traceId === '00000000000000000000000000000000') return null;
  return ctx;
}
