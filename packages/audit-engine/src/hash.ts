// SPDX-License-Identifier: BUSL-1.1
import { createHash } from 'node:crypto';

export const GENESIS_HASH = '0'.repeat(64);

export function canonicalJsonStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(v: unknown): unknown {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(canonicalize);
  const obj = v as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const out: Record<string, unknown> = {};
  for (const k of sortedKeys) {
    out[k] = canonicalize(obj[k]);
  }
  return out;
}

export function sha256Hex(...parts: string[]): string {
  const h = createHash('sha256');
  for (const p of parts) h.update(p, 'utf8');
  return h.digest('hex');
}

export function computeChainHash(
  prevHash: string,
  canonicalPayload: string,
  metadata: string,
): string {
  return sha256Hex(prevHash, '|', canonicalPayload, '|', metadata);
}
