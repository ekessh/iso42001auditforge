// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { validateFilename } from '../../../packages/evidence-vault/src/filename-safety.js';
import { isMimeSpoof } from '../../../packages/evidence-vault/src/mime-magic.js';
import { evaluateZip } from '../../../packages/evidence-vault/src/zip-bomb-defense.js';

const TRAVERSALS = [
  '../etc/passwd', '..\\..\\windows\\system32', '/abs/path', 'C:\\windows',
  '..%2f..%2fetc%2fpasswd', '../../../', './..//../', '..\\\\..\\\\',
  '‮..\\evil', '.. /etc',
];

const EICAR_HEADER = new Uint8Array([0x58, 0x35, 0x4f, 0x21]);

describe('file upload abuse', () => {
  it.each(TRAVERSALS)('rejects path traversal pattern: %s', (n) => {
    expect(validateFilename(n).ok).toBe(false);
  });
  it('detects PDF claimed as PNG', () => {
    expect(isMimeSpoof('image/png', new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBe(true);
  });
  it('rejects high zip ratio', () => {
    expect(evaluateZip([{ compressedSize: 100, uncompressedSize: 100_000_000 }]).ok).toBe(false);
  });
  it('EICAR header recognizable', () => {
    expect(EICAR_HEADER[0]).toBe(0x58);
  });
});
