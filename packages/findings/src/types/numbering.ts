// SPDX-License-Identifier: BUSL-1.1
/**
 * Numbering scheme types. A scheme is a named, format-string-driven recipe
 * for producing a unique finding number per CB / per scheme owner.
 *
 * Variables supported in a format string (see `NumberingService.format`):
 *
 *   {scheme}      — the scheme key (e.g. "NC", "OFI")
 *   {year}        — 4-digit year of the finding's `raisedAt`
 *   {yy}          — 2-digit year
 *   {month}       — 2-digit month
 *   {seq}         — zero-padded sequence number (per the scheme's `pad` width)
 *   {seqRaw}      — unpadded sequence number
 *   {engagement}  — the engagement's short code (passed in at format time)
 *   {client}      — the client's short code (passed in at format time)
 *   {type}        — the finding's `type` (e.g. "major_nc")
 */
import type { FindingType } from './finding.js';

export interface NumberingScheme {
  /** Unique key per CB (e.g. `"NC"`, `"OFI"`, `"ACME-NC-2025"`). */
  readonly key: string;
  /** Human-readable name, used in CB admin UI. */
  readonly name: string;
  /**
   * The set of finding types this scheme applies to. Several schemes can
   * map to the same type (e.g. major and minor NCs can share `"NC"`); the
   * default registry binds {`major_nc`,`minor_nc`} to `"NC"` and `ofi` to
   * `"OFI"`.
   */
  readonly appliesTo: readonly FindingType[];
  /**
   * Format template (see top of file for variables).
   * Example: `"NC-{year}-{seq}"` or `"OFI-{engagement}-{seq}"`.
   */
  readonly template: string;
  /** Zero-pad width for the sequence number (default `4`). */
  readonly pad: number;
  /**
   * Sequence reset boundary. A new boundary value gets a fresh counter at 1.
   *
   * - `'never'` — counter never resets (lifetime of the scheme)
   * - `'year'`  — resets each calendar year
   * - `'engagement'` — resets per engagement
   */
  readonly reset: 'never' | 'year' | 'engagement';
}

export interface NumberingFormatInput {
  readonly schemeKey: string;
  readonly type: FindingType;
  readonly raisedAt: string; // ISO 8601 timestamp
  readonly engagementCode?: string;
  readonly clientCode?: string;
}
