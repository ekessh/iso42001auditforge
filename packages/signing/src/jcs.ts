// SPDX-License-Identifier: BUSL-1.1

import { ValidationError } from '@auditforge/shared';

export type JcsValue =
  | null
  | boolean
  | number
  | string
  | JcsValue[]
  | { [k: string]: JcsValue };

export function canonicalize(value: unknown): string {
  if (value === undefined) {
    throw new ValidationError('JCS: undefined is not a valid JSON value');
  }
  return serialize(value as JcsValue);
}

export function canonicalizeToBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(canonicalize(value));
}

function serialize(v: JcsValue): string {
  if (v === null) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return serializeNumber(v);
  if (typeof v === 'string') return serializeString(v);
  if (Array.isArray(v)) return serializeArray(v);
  if (typeof v === 'object') return serializeObject(v);
  throw new ValidationError(`JCS: unsupported type ${typeof v}`);
}

function serializeNumber(n: number): string {
  if (!Number.isFinite(n)) {
    throw new ValidationError('JCS: NaN/Infinity not permitted');
  }
  if (n === 0) return '0';
  // RFC 8785 §3.2.2.3 references ECMA-262 7.1.12.1; modern JS Number.prototype.toString already yields the shortest correct form per IEEE-754 round-trip, matching ECMA-404. We additionally drop the leading "+e" → "e" form (toString already does this) and ensure exponent uses "e+" style. ES2018+ Number.prototype.toString meets RFC 8785's expectation directly.
  return n.toString();
}

function serializeString(s: string): string {
  let out = '"';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 0x22) out += '\\"';
    else if (c === 0x5c) out += '\\\\';
    else if (c === 0x08) out += '\\b';
    else if (c === 0x09) out += '\\t';
    else if (c === 0x0a) out += '\\n';
    else if (c === 0x0c) out += '\\f';
    else if (c === 0x0d) out += '\\r';
    else if (c < 0x20) out += `\\u${c.toString(16).padStart(4, '0')}`;
    else out += s[i];
  }
  return out + '"';
}

function serializeArray(arr: JcsValue[]): string {
  if (arr.length === 0) return '[]';
  const parts: string[] = [];
  for (const item of arr) parts.push(serialize(item));
  return '[' + parts.join(',') + ']';
}

function serializeObject(obj: { [k: string]: JcsValue }): string {
  const keys = Object.keys(obj).sort(compareUtf16);
  if (keys.length === 0) return '{}';
  const parts: string[] = [];
  for (const k of keys) {
    const v = obj[k];
    if (v === undefined) continue;
    parts.push(serializeString(k) + ':' + serialize(v as JcsValue));
  }
  return '{' + parts.join(',') + '}';
}

function compareUtf16(a: string, b: string): number {
  // RFC 8785 §3.2.3 — lexicographic compare on UTF-16 code units.
  const la = a.length;
  const lb = b.length;
  const min = la < lb ? la : lb;
  for (let i = 0; i < min; i++) {
    const ca = a.charCodeAt(i);
    const cb = b.charCodeAt(i);
    if (ca !== cb) return ca - cb;
  }
  return la - lb;
}
