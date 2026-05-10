// SPDX-License-Identifier: BUSL-1.1
/**
 * Browser-side string redactor. Mirrors `@auditforge/observability/redact` but lives in the web
 * app to keep the bundle slim (no server-only imports leak in).
 */

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE =
  /(?<![\w-])(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{2,4}[\s.-]?\d{2,4}[\s.-]?\d{2,4}(?![\w-])/g;
const SSN_LIKE = /(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)/g;
const CREDIT_CARD = /(?<!\d)(?:\d[ -]?){13,19}(?!\d)/g;
const IPV4 =
  /(?<!\d)(?:25[0-5]|2[0-4]\d|[01]?\d{1,2})(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d{1,2})){3}(?!\d)/g;
const JWT = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{6,}/g;
const BEARER = /Bearer\s+[A-Za-z0-9._~+/-]+=*/g;

export function redactString(s: string): string {
  return s
    .replace(EMAIL, '[REDACTED:email]')
    .replace(JWT, '[REDACTED:jwt]')
    .replace(BEARER, '[REDACTED:bearer]')
    .replace(SSN_LIKE, '[REDACTED:ssn]')
    .replace(CREDIT_CARD, '[REDACTED:cc]')
    .replace(PHONE, '[REDACTED:phone]')
    .replace(IPV4, '[REDACTED:ipv4]');
}
