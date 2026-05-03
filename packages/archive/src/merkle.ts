// SPDX-License-Identifier: BUSL-1.1
import { createHash } from 'node:crypto';

function h(buf: string | Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

export function leafHash(content: Uint8Array | string): string {
  return h(typeof content === 'string' ? content : Buffer.from(content));
}

export function computeMerkleRoot(leaves: string[]): string {
  if (leaves.length === 0) throw new Error('empty leaves');
  let layer = leaves.slice();
  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const a = layer[i]!;
      const b = layer[i + 1] ?? a;
      next.push(h(a + b));
    }
    layer = next;
  }
  return layer[0]!;
}

export interface BundleEntry {
  path: string;
  hash: string;
}

export function bundleManifestRoot(entries: BundleEntry[]): string {
  const sorted = entries.slice().sort((a, b) => a.path.localeCompare(b.path));
  return computeMerkleRoot(sorted.map((e) => h(`${e.path}:${e.hash}`)));
}
