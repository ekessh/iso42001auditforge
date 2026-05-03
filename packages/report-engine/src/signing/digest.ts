// SPDX-License-Identifier: BUSL-1.1
import { createHash } from 'node:crypto';

/** SHA-256 of bytes, lowercase hex. */
export function sha256Hex(bytes: Uint8Array | string): string {
  return createHash('sha256')
    .update(typeof bytes === 'string' ? bytes : Buffer.from(bytes))
    .digest('hex');
}
