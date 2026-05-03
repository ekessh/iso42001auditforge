// SPDX-License-Identifier: BUSL-1.1

export interface ZipBombPolicy {
  maxUncompressedBytes: number;
  maxRatio: number;
  maxEntries: number;
}

export const DEFAULT_POLICY: ZipBombPolicy = {
  maxUncompressedBytes: 500 * 1024 * 1024,
  maxRatio: 100,
  maxEntries: 10_000,
};

export interface ZipEntry { compressedSize: number; uncompressedSize: number }

export function evaluateZip(entries: ZipEntry[], policy = DEFAULT_POLICY): { ok: boolean; reason?: string } {
  if (entries.length > policy.maxEntries) return { ok: false, reason: 'too many entries' };
  let totalUncompressed = 0;
  let totalCompressed = 0;
  for (const e of entries) {
    totalUncompressed += e.uncompressedSize;
    totalCompressed += e.compressedSize;
    if (totalUncompressed > policy.maxUncompressedBytes) return { ok: false, reason: 'uncompressed too large' };
  }
  if (totalCompressed > 0) {
    const ratio = totalUncompressed / totalCompressed;
    if (ratio > policy.maxRatio) return { ok: false, reason: `ratio ${ratio.toFixed(1)} exceeds ${policy.maxRatio}` };
  }
  return { ok: true };
}
