// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { assertSafeRelativePath, isSafeRelativePath } from '../src/path-safety.js';

describe('path-safety', () => {
  it('accepts a simple relative file name', () => {
    expect(isSafeRelativePath('soa.xlsx')).toBe(true);
  });

  it('accepts a nested relative path', () => {
    expect(isSafeRelativePath('imports/2026-05/soa.xlsx')).toBe(true);
  });

  it('rejects POSIX absolute paths', () => {
    expect(() => assertSafeRelativePath('/etc/passwd')).toThrow();
  });

  it('rejects Windows drive-rooted paths', () => {
    expect(() => assertSafeRelativePath('C:\\Users\\evil\\soa.xlsx')).toThrow();
    expect(() => assertSafeRelativePath('d:/data/soa.csv')).toThrow();
  });

  it('rejects UNC paths', () => {
    expect(() => assertSafeRelativePath('\\\\server\\share\\soa.xlsx')).toThrow();
    expect(() => assertSafeRelativePath('//server/share/soa.xlsx')).toThrow();
  });

  it('rejects path traversal segments', () => {
    expect(() => assertSafeRelativePath('../../../etc/passwd')).toThrow();
    expect(() => assertSafeRelativePath('imports/../../etc/passwd')).toThrow();
  });

  it('rejects NUL byte in path', () => {
    expect(() => assertSafeRelativePath('soa.xlsx\x00malicious')).toThrow();
  });

  it('rejects empty paths', () => {
    expect(() => assertSafeRelativePath('')).toThrow();
  });

  it('rejects oversize paths', () => {
    const long = 'a/'.repeat(600) + 'soa.xlsx';
    expect(() => assertSafeRelativePath(long)).toThrow();
  });
});
