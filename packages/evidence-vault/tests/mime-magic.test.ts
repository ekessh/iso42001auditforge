// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { detectMime, isMimeSpoof } from '../src/mime-magic.js';

describe('mime magic', () => {
  it('detects PDF', () => {
    expect(detectMime(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]))).toBe('application/pdf');
  });
  it('detects PNG', () => {
    expect(detectMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]))).toBe('image/png');
  });
  it('detects JPEG', () => {
    expect(detectMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
  });
  it('isMimeSpoof flags PDF claimed as PNG', () => {
    const head = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    expect(isMimeSpoof('image/png', head)).toBe(true);
  });
  it('isMimeSpoof allows DOCX as zip', () => {
    const head = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    expect(isMimeSpoof('application/vnd.openxmlformats-officedocument.wordprocessingml.document', head)).toBe(false);
  });
});
