// SPDX-License-Identifier: BUSL-1.1
/**
 * String-level PII redaction.
 *
 * WHY string-level (vs. pino-redact path-based): logs and error reports often hold free-form text
 * (stack traces, exception messages, RUM event payloads) where PII appears inline rather than at a
 * known field path. This module redacts patterns rather than paths so it can be applied to any
 * value before it leaves the process.
 */

const EMAIL =
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

const PHONE =
  /(?<![\w-])(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{2,4}[\s.-]?\d{2,4}[\s.-]?\d{2,4}(?![\w-])/g;

const SSN_LIKE = /(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)/g;

const CREDIT_CARD =
  /(?<!\d)(?:\d[ -]?){13,19}(?!\d)/g;

const IPV4 =
  /(?<!\d)(?:25[0-5]|2[0-4]\d|[01]?\d{1,2})(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d{1,2})){3}(?!\d)/g;

const JWT =
  /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{6,}/g;

const BEARER = /Bearer\s+[A-Za-z0-9._~+/-]+=*/g;

const AWS_KEY = /AKIA[0-9A-Z]{16}/g;

export interface RedactPattern {
  readonly name: string;
  readonly pattern: RegExp;
  readonly replacement: string;
}

export const DEFAULT_REDACT_PATTERNS: ReadonlyArray<RedactPattern> = Object.freeze([
  Object.freeze({ name: 'email', pattern: EMAIL, replacement: '[REDACTED:email]' }),
  Object.freeze({ name: 'jwt', pattern: JWT, replacement: '[REDACTED:jwt]' }),
  Object.freeze({ name: 'bearer', pattern: BEARER, replacement: '[REDACTED:bearer]' }),
  Object.freeze({ name: 'ssn', pattern: SSN_LIKE, replacement: '[REDACTED:ssn]' }),
  Object.freeze({ name: 'credit_card', pattern: CREDIT_CARD, replacement: '[REDACTED:cc]' }),
  Object.freeze({ name: 'aws_key', pattern: AWS_KEY, replacement: '[REDACTED:aws_key]' }),
  Object.freeze({ name: 'phone', pattern: PHONE, replacement: '[REDACTED:phone]' }),
  Object.freeze({ name: 'ipv4', pattern: IPV4, replacement: '[REDACTED:ipv4]' }),
]);

export interface RedactOptions {
  readonly patterns?: ReadonlyArray<RedactPattern>;
  readonly maxDepth?: number;
}

const MAX_DEFAULT_DEPTH = 8;

export function redactString(input: string, opts: RedactOptions = {}): string {
  const patterns = opts.patterns ?? DEFAULT_REDACT_PATTERNS;
  let out = input;
  for (const p of patterns) {
    out = out.replace(p.pattern, p.replacement);
  }
  return out;
}

export function redactValue<T>(input: T, opts: RedactOptions = {}): T {
  const maxDepth = opts.maxDepth ?? MAX_DEFAULT_DEPTH;
  return walk(input, maxDepth, opts) as T;
}

function walk(value: unknown, depth: number, opts: RedactOptions): unknown {
  if (depth <= 0) return value;
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactString(value, opts);
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((v) => walk(v, depth - 1, opts));
  }
  if (value instanceof Date) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = walk(v, depth - 1, opts);
  }
  return out;
}

export function buildRedactor(opts: RedactOptions = {}) {
  return {
    string: (s: string): string => redactString(s, opts),
    value: <T>(v: T): T => redactValue<T>(v, opts),
  };
}
