// SPDX-License-Identifier: BUSL-1.1

import type { ReportVerdict } from '../domain.js';

/**
 * Helpers callable as `{{helper arg}}` or `{{helper arg "format"}}` from a
 * template. All helpers are pure functions on already-resolved values.
 */
export type Helper = (...args: readonly unknown[]) => string;

/**
 * `dateFormat(value, format)` — minimal deterministic ISO formatter. `format`
 * may be: `iso`, `date`, `long`, or a strftime-like subset (`%Y-%m-%d`).
 * Designed so EN locale + UTC produces stable, reviewable output.
 */
export const dateFormat: Helper = (...args) => {
  const [value, format] = args as [unknown, unknown];
  const fmt = typeof format === 'string' && format.length > 0 ? format : 'iso';
  if (typeof value !== 'string' && !(value instanceof Date)) {
    throw new TypeError('dateFormat: expected string or Date');
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new TypeError('dateFormat: invalid date');
  }
  const yyyy = d.getUTCFullYear().toString().padStart(4, '0');
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = d.getUTCDate().toString().padStart(2, '0');
  if (fmt === 'iso') return d.toISOString();
  if (fmt === 'date') return `${yyyy}-${mm}-${dd}`;
  if (fmt === 'long') {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${yyyy}`;
  }
  return fmt
    .replace('%Y', yyyy)
    .replace('%m', mm)
    .replace('%d', dd);
};

/**
 * `clauseLink(clause)` — produce reviewer-friendly link text. Renderers may
 * later promote this into an actual hyperlink. Acceptable inputs:
 * `5.2`, `9.4.1`, `A.5.4`, `EU-AI-Act/Art.13`.
 */
export const clauseLink: Helper = (...args) => {
  const [clause] = args as [unknown];
  if (typeof clause !== 'string' || clause.length === 0) {
    throw new TypeError('clauseLink: expected non-empty string');
  }
  if (clause.startsWith('A.')) return `ISO 42001 Annex ${clause}`;
  if (clause.startsWith('EU-AI-Act/')) {
    return clause.replace('EU-AI-Act/', 'EU AI Act ');
  }
  if (/^[0-9]+(?:\.[0-9]+)*$/.test(clause)) return `ISO 42001 Clause ${clause}`;
  return clause;
};

/**
 * `verdictPill(v)` — text-only rendering of a verdict pill. Renderers handle
 * actual color via the branding theme.
 */
export const verdictPill: Helper = (...args) => {
  const [v] = args as [unknown];
  const verdict = v as ReportVerdict;
  switch (verdict) {
    case 'conformant':
      return '[CONFORMANT]';
    case 'minor_nc':
      return '[MINOR NC]';
    case 'major_nc':
      return '[MAJOR NC]';
    case 'ofi':
      return '[OFI]';
    case 'na':
      return '[N/A]';
    default:
      throw new TypeError(`verdictPill: unknown verdict ${String(v)}`);
  }
};

/**
 * `findingNo(num)` — accepts either a string already in canonical form, or a
 * tuple of `{type, year, seq}`.
 */
export const findingNo: Helper = (...args) => {
  const [num] = args as [unknown];
  if (typeof num === 'string') return num;
  if (
    typeof num === 'object' &&
    num !== null &&
    'type' in num &&
    'year' in num &&
    'seq' in num
  ) {
    const o = num as { type: string; year: number; seq: number };
    const type = o.type === 'major_nc'
      ? 'NC-MAJ'
      : o.type === 'minor_nc'
        ? 'NC-MIN'
        : 'OFI';
    return `${type}-${o.year}-${o.seq.toString().padStart(3, '0')}`;
  }
  throw new TypeError('findingNo: invalid argument');
};

export const defaultHelpers: Readonly<Record<string, Helper>> = Object.freeze({
  dateFormat,
  clauseLink,
  verdictPill,
  findingNo,
});
