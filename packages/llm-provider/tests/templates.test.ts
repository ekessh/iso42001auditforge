// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { PromptTemplateRegistry, TemplateMismatch } from '../src/index.js';

describe('PromptTemplateRegistry', () => {
  it('registers a template, hashes it, and returns it on get', () => {
    const r = new PromptTemplateRegistry();
    const t = r.register('v1', 'You are helpful.');
    expect(t.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(r.get('v1').version).toBe('v1');
  });

  it('throws TemplateMismatch and records the mismatch when getting an unknown version', () => {
    const r = new PromptTemplateRegistry();
    expect(() => r.get('vMissing')).toThrowError(TemplateMismatch);
    expect(r.recordedMismatches().length).toBe(1);
  });

  it('rejects duplicate registration', () => {
    const r = new PromptTemplateRegistry();
    r.register('v1', 'a');
    expect(() => r.register('v1', 'b')).toThrow();
  });

  it('hashes are deterministic for the same body', () => {
    const r1 = new PromptTemplateRegistry();
    const r2 = new PromptTemplateRegistry();
    expect(r1.register('v1', 'x').hash).toBe(r2.register('v1', 'x').hash);
  });

  it('hashes differ for different bodies', () => {
    const r = new PromptTemplateRegistry();
    expect(r.register('v1', 'x').hash).not.toBe(r.register('v2', 'y').hash);
  });
});
