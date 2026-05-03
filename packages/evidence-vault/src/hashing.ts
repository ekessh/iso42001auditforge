// SPDX-License-Identifier: BUSL-1.1
import { createHash } from 'node:crypto';

export function sha256(buf: Uint8Array | string): string {
  return createHash('sha256').update(buf).digest('hex');
}

export function sha3_256(buf: Uint8Array | string): string {
  return createHash('sha3-256').update(buf).digest('hex');
}

export interface DualHash {
  sha256: string;
  sha3_256: string;
}

export function hashBoth(buf: Uint8Array | string): DualHash {
  return { sha256: sha256(buf), sha3_256: sha3_256(buf) };
}

export function verifyHash(buf: Uint8Array | string, expected: DualHash): boolean {
  const actual = hashBoth(buf);
  return actual.sha256 === expected.sha256 && actual.sha3_256 === expected.sha3_256;
}
