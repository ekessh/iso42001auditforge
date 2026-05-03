// SPDX-License-Identifier: BUSL-1.1
import { createHash, type BinaryLike } from 'node:crypto';

/** SHA-256 hex digest of the given input. */
export function sha256(data: BinaryLike): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Stable JSON stringify (sorted keys, deterministic) — needed because we hash
 * params + results into the audit ledger.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    out[k] = canonicalize((value as Record<string, unknown>)[k]);
  }
  return out;
}

export function sha256Json(value: unknown): string {
  return sha256(stableStringify(value));
}
