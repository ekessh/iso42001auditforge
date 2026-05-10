// SPDX-License-Identifier: BUSL-1.1
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /\b\+?\d[\d\s().-]{7,}\d\b/g;
const SSN = /\b\d{3}-\d{2}-\d{4}\b/g;
const CC = /\b(?:\d[ -]?){13,16}\b/g;

export function redactPiiInString(s: string): string {
  return s
    .replace(EMAIL, '[REDACTED_EMAIL]')
    .replace(SSN, '[REDACTED_SSN]')
    .replace(CC, '[REDACTED_CC]')
    .replace(PHONE, '[REDACTED_PHONE]');
}

export function redactPiiDeep<T>(value: T): T {
  if (typeof value === 'string') return redactPiiInString(value) as T;
  if (Array.isArray(value)) {
    return value.map((v) => redactPiiDeep(v)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactPiiDeep(v);
    }
    return out as T;
  }
  return value;
}
